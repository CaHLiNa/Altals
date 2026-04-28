use regex_lite::Regex;
use std::path::{Path, PathBuf};

use crate::latex::LatexError;

pub(crate) fn parse_latex_output(output: &str) -> (Vec<LatexError>, Vec<LatexError>) {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let undefined_ref_re =
        Regex::new(r#"^LaTeX Warning: (Reference|Citation) `([^']+)' .* input line (\d+)\.$"#).ok();
    let package_warning_re =
        Regex::new(r#"^(Package|Class) .+ Warning: .+ on input line (\d+)\.?$"#).ok();
    let generic_line_re = Regex::new(r"\bline (\d+)\b").ok();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if trimmed.starts_with("error:") {
            let msg = trimmed.strip_prefix("error:").unwrap_or(trimmed).trim();
            let (line_num, message) = extract_line_number(msg);
            errors.push(make_latex_issue(
                None,
                line_num,
                None,
                message,
                "error",
                Some(trimmed.to_string()),
            ));
        } else if trimmed.starts_with("warning:") {
            let msg = trimmed.strip_prefix("warning:").unwrap_or(trimmed).trim();
            let (line_num, message) = extract_line_number(msg);
            warnings.push(make_latex_issue(
                None,
                line_num,
                None,
                message,
                "warning",
                Some(trimmed.to_string()),
            ));
        } else if trimmed.starts_with('!') {
            let msg = trimmed.strip_prefix('!').unwrap_or(trimmed).trim();
            errors.push(make_latex_issue(
                None,
                None,
                None,
                msg,
                "error",
                Some(trimmed.to_string()),
            ));
        } else if trimmed.starts_with("l.") {
            if let Some(num_str) = trimmed.strip_prefix("l.") {
                let parts: Vec<&str> = num_str.splitn(2, ' ').collect();
                if let Ok(line_num) = parts[0].parse::<u32>() {
                    if let Some(last) = errors.last_mut() {
                        if last.line.is_none() {
                            last.line = Some(line_num);
                        }
                        if last.raw.is_none() {
                            last.raw = Some(trimmed.to_string());
                        }
                    }
                }
            }
        } else if let Some(line_num) =
            extract_warning_continuation_line(trimmed, generic_line_re.as_ref())
        {
            if let Some(last) = warnings.last_mut() {
                if last.line.is_none() {
                    last.line = Some(line_num);
                }
                last.raw = Some(match last.raw.take() {
                    Some(raw) if !raw.is_empty() => format!("{raw}\n{trimmed}"),
                    _ => trimmed.to_string(),
                });
            }
        } else if let Some((file, line_num, column, message)) = extract_file_line_col_error(trimmed)
        {
            if is_latex_warning_line(message) {
                warnings.push(make_latex_issue(
                    Some(file),
                    Some(line_num),
                    Some(column),
                    message,
                    "warning",
                    Some(trimmed.to_string()),
                ));
            } else {
                errors.push(make_latex_issue(
                    Some(file),
                    Some(line_num),
                    Some(column),
                    message,
                    "error",
                    Some(trimmed.to_string()),
                ));
            }
        } else if let Some((file, line_num, message)) = extract_file_line_error(trimmed) {
            if is_latex_warning_line(message) {
                warnings.push(make_latex_issue(
                    Some(file),
                    Some(line_num),
                    None,
                    message,
                    "warning",
                    Some(trimmed.to_string()),
                ));
            } else {
                errors.push(make_latex_issue(
                    Some(file),
                    Some(line_num),
                    None,
                    message,
                    "error",
                    Some(trimmed.to_string()),
                ));
            }
        } else if is_latex_warning_line(trimmed) {
            let mut line_num = extract_line_number_from_warning(trimmed, generic_line_re.as_ref());
            if line_num.is_none() {
                if let Some(re) = undefined_ref_re.as_ref() {
                    line_num = re
                        .captures(trimmed)
                        .and_then(|captures| captures.get(3))
                        .and_then(|value| value.as_str().parse::<u32>().ok());
                }
            }
            if line_num.is_none() {
                if let Some(re) = package_warning_re.as_ref() {
                    line_num = re
                        .captures(trimmed)
                        .and_then(|captures| captures.get(2))
                        .and_then(|value| value.as_str().parse::<u32>().ok());
                }
            }
            warnings.push(make_latex_issue(
                None,
                line_num,
                None,
                trimmed,
                "warning",
                Some(trimmed.to_string()),
            ));
        }
    }

    (errors, warnings)
}

fn is_latex_warning_line(line: &str) -> bool {
    let trimmed = line.trim();
    let lowered = trimmed.to_ascii_lowercase();

    trimmed.contains("LaTeX Warning:")
        || trimmed.contains("LaTeX Font Warning:")
        || trimmed.contains("LaTeX3 Warning:")
        || (trimmed.starts_with("Package ") && trimmed.contains(" Warning:"))
        || (trimmed.starts_with("Class ") && trimmed.contains(" Warning:"))
        || lowered.starts_with("pdftex warning")
        || lowered.starts_with("xetex warning")
        || lowered.starts_with("luatex warning")
        || lowered.starts_with("warning--")
        || trimmed.starts_with("Overfull ")
        || trimmed.starts_with("Underfull ")
        || trimmed.contains("undefined references")
        || trimmed.contains("Label(s) may have changed")
        || lowered.starts_with("latexmk: summary of warnings")
        || lowered.contains("latex failed to resolve")
}

fn make_latex_issue(
    file: Option<String>,
    line: Option<u32>,
    column: Option<u32>,
    message: impl Into<String>,
    severity: &str,
    raw: Option<String>,
) -> LatexError {
    LatexError {
        file,
        line,
        column,
        message: message.into(),
        severity: severity.to_string(),
        raw,
    }
}

fn extract_file_line_col_error(line: &str) -> Option<(String, u32, u32, &str)> {
    let parts: Vec<&str> = line.splitn(4, ':').collect();
    if parts.len() < 4 {
        return None;
    }
    let file = parts[0].trim();
    let line_num = parts[1].trim().parse::<u32>().ok()?;
    let column = parts[2].trim().parse::<u32>().ok()?;
    Some((file.to_string(), line_num, column, parts[3].trim()))
}

fn extract_file_line_error(line: &str) -> Option<(String, u32, &str)> {
    let parts: Vec<&str> = line.splitn(3, ':').collect();
    if parts.len() < 3 {
        return None;
    }
    let file = parts[0].trim();
    let line_num = parts[1].trim().parse::<u32>().ok()?;
    Some((file.to_string(), line_num, parts[2].trim()))
}

fn extract_line_number(msg: &str) -> (Option<u32>, &str) {
    if let Some(idx) = msg.find("line ") {
        let after = &msg[idx + 5..];
        let num_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(n) = num_str.parse::<u32>() {
            return (Some(n), msg);
        }
    }
    (None, msg)
}

fn extract_line_number_from_warning(msg: &str, generic_line_re: Option<&Regex>) -> Option<u32> {
    if let Some((line, _)) = extract_overfull_underfull_range(msg) {
        return Some(line);
    }
    if let Some(re) = generic_line_re {
        if let Some(captures) = re.captures(msg) {
            return captures
                .get(1)
                .and_then(|value| value.as_str().parse::<u32>().ok());
        }
    }
    None
}

fn extract_warning_continuation_line(line: &str, generic_line_re: Option<&Regex>) -> Option<u32> {
    let trimmed = line.trim();
    if !trimmed.starts_with('(') || !trimmed.contains("input line") {
        return None;
    }
    extract_line_number_from_warning(trimmed, generic_line_re)
}

fn extract_overfull_underfull_range(msg: &str) -> Option<(u32, u32)> {
    if let Some(index) = msg.find("lines ") {
        let after = &msg[index + 6..];
        let parts: Vec<&str> = after.split("--").collect();
        if parts.len() >= 2 {
            let start = parts[0].trim().parse::<u32>().ok()?;
            let end_digits: String = parts[1]
                .chars()
                .take_while(|ch| ch.is_ascii_digit())
                .collect();
            let end = end_digits.parse::<u32>().ok()?;
            return Some((start, end));
        }
    }
    if let Some(index) = msg.find("line ") {
        let after = &msg[index + 5..];
        let digits: String = after.chars().take_while(|ch| ch.is_ascii_digit()).collect();
        if let Ok(line_num) = digits.parse::<u32>() {
            return Some((line_num, line_num));
        }
    }
    None
}

pub(crate) fn parse_chktex_output(output: &str) -> Vec<LatexError> {
    let mut diagnostics = Vec::new();

    for raw_line in output.lines() {
        let trimmed = raw_line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.split('\u{1f}').collect();
        if parts.len() < 6 {
            continue;
        }

        let file = parts[0].trim();
        let line = parts[1].trim().parse::<u32>().ok();
        let column = parts[2].trim().parse::<u32>().ok();
        let kind = parts[3].trim();
        let code = parts[4].trim();
        let message = parts[5].trim();

        let severity = if kind.eq_ignore_ascii_case("error") {
            "error"
        } else {
            "warning"
        };

        let formatted_message = if code.is_empty() {
            format!("ChkTeX: {}", message)
        } else {
            format!("ChkTeX {}: {}", code, message)
        };

        diagnostics.push(make_latex_issue(
            if file.is_empty() {
                None
            } else {
                Some(file.to_string())
            },
            line,
            column,
            formatted_message,
            severity,
            Some(trimmed.to_string()),
        ));
    }

    diagnostics
}

pub(crate) fn default_chktex_args() -> Vec<&'static str> {
    vec!["-wall", "-n22", "-n30", "-e16", "-q"]
}

pub(crate) fn discover_chktexrc(tex_path: &str, workspace_path: Option<&str>) -> Option<PathBuf> {
    let tex_dir = Path::new(tex_path).parent()?;
    let workspace_root = workspace_path
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from);

    let mut current = Some(tex_dir.to_path_buf());
    while let Some(dir) = current {
        let candidate = dir.join(".chktexrc");
        if candidate.exists() {
            return Some(candidate);
        }

        if workspace_root.as_ref().is_some_and(|root| dir == *root) {
            break;
        }
        current = dir.parent().map(Path::to_path_buf);
    }

    global_chktexrc()
}

fn global_chktexrc() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        for value in [
            std::env::var("CHKTEXRC")
                .ok()
                .map(|dir| PathBuf::from(dir).join("chktexrc")),
            std::env::var("CHKTEX_HOME")
                .ok()
                .map(|dir| PathBuf::from(dir).join("chktexrc")),
            std::env::var("EMTEXDIR")
                .ok()
                .map(|dir| PathBuf::from(dir).join("data").join("chktexrc")),
        ]
        .into_iter()
        .flatten()
        {
            if value.exists() {
                return Some(value);
            }
        }
    }

    #[cfg(not(windows))]
    {
        for value in [
            std::env::var("HOME")
                .ok()
                .map(|dir| PathBuf::from(dir).join(".chktexrc")),
            std::env::var("LOGDIR")
                .ok()
                .map(|dir| PathBuf::from(dir).join(".chktexrc")),
            std::env::var("CHKTEXRC")
                .ok()
                .map(|dir| PathBuf::from(dir).join(".chktexrc")),
        ]
        .into_iter()
        .flatten()
        {
            if value.exists() {
                return Some(value);
            }
        }
    }

    None
}

pub(crate) fn read_chktex_tab_size(rc_path: Option<&Path>) -> Option<usize> {
    let path = rc_path?;
    let contents = std::fs::read_to_string(path).ok()?;
    let tab_size_re = Regex::new(r"(?m)^\s*TabSize\s*=\s*(\d+)\s*$").ok()?;
    let captures = tab_size_re.captures(&contents)?;
    captures.get(1)?.as_str().parse::<usize>().ok()
}

fn convert_chktex_column(column: u32, line: &str, tab_size: usize) -> u32 {
    if column <= 1 {
        return column;
    }

    let target = column.saturating_sub(1) as usize;
    let mut consumed = 0usize;
    let mut visual_column = 0usize;

    for ch in line.chars() {
        if consumed >= target {
            break;
        }
        let width = if ch == '\t' { tab_size } else { ch.len_utf8() };
        consumed += width;
        visual_column += 1;
    }

    (visual_column + 1) as u32
}

pub(crate) fn adjust_chktex_columns_for_source(
    diagnostics: &mut [LatexError],
    tex_path: &str,
    source_content: &str,
    tab_size: usize,
) {
    let source_lines: Vec<&str> = source_content.lines().collect();
    let tex_path = Path::new(tex_path);

    for diagnostic in diagnostics.iter_mut() {
        let Some(line) = diagnostic.line else {
            continue;
        };
        let Some(column) = diagnostic.column else {
            continue;
        };
        let line_index = line.saturating_sub(1) as usize;
        let Some(line_text) = source_lines.get(line_index) else {
            continue;
        };

        let matches_source = diagnostic.file.as_deref().is_none_or(|file| {
            let diagnostic_path = Path::new(file);
            diagnostic_path == tex_path || diagnostic_path.file_name() == tex_path.file_name()
        });
        if !matches_source {
            continue;
        }

        diagnostic.column = Some(convert_chktex_column(column, line_text, tab_size));
    }
}

#[cfg(test)]
mod tests {
    use super::parse_latex_output;

    #[test]
    fn parses_latex_font_warning_lines() {
        let (_, warnings) = parse_latex_output(
            "LaTeX Font Warning: Font shape `OMS/cmr/m/n' undefined\n\
             (Font)              using `OMS/cmsy/m/n' instead on input line 42.",
        );

        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].severity, "warning");
        assert_eq!(warnings[0].line, Some(42));
    }

    #[test]
    fn parses_engine_warning_lines() {
        let (_, warnings) = parse_latex_output(
            "pdfTeX warning (ext4): destination with the same identifier \
             (name{page.1}) has been already used, duplicate ignored",
        );

        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].severity, "warning");
    }

    #[test]
    fn parses_file_line_warning_as_warning_not_error() {
        let (errors, warnings) = parse_latex_output(
            "main.tex:12: LaTeX Font Warning: Some font shapes were not available.",
        );

        assert!(errors.is_empty());
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].file.as_deref(), Some("main.tex"));
        assert_eq!(warnings[0].line, Some(12));
    }

    #[test]
    fn parses_latexmk_warning_summary_lines() {
        let (_, warnings) = parse_latex_output(
            "Latexmk: Summary of warnings from last run of *latex:\n\
             Latex failed to resolve 1 reference(s)",
        );

        assert_eq!(warnings.len(), 2);
        assert!(warnings.iter().all(|warning| warning.severity == "warning"));
    }
}
