# ScribeFlow PDF Translator Plugin

This directory is a ScribeFlow plugin package, not a pointer to a system CLI.

ScribeFlow discovers this plugin by reading `plugin.json`, renders its `settingsSchema` in Settings -> Plugins, and runs the plugin-local runner:

```text
bin/scribeflow-pdf-translator
```

The runner receives a shell-free argument envelope:

```text
--capability pdf.translate
--input-pdf /absolute/input.pdf
--output-dir /absolute/scribeflow/artifacts/plugins/<plugin>/<job>
--settings-json {"modelProvider":"openai","model":"gpt-4.1-mini"}
```

The placeholder runner in this repository is not the real translator and is intentionally not executable. The real plugin repository should replace `bin/scribeflow-pdf-translator` with its packaged executable runner and dependencies. Users install it by downloading the plugin folder from GitHub and placing it under one of:

```text
~/.scribeflow/plugins/
<workspace>/.scribeflow/plugins/
```

ScribeFlow does not call `pdf2zh` directly. If this plugin wants to use PDFMathTranslate, LLM APIs, local models, OCR engines, or layout tools, that belongs inside the plugin runner.
