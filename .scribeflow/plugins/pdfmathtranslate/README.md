# PDFMathTranslate Plugin

This workspace plugin connects ScribeFlow's `pdf.translate` capability to the local `pdf2zh` command from PDFMathTranslate.

ScribeFlow does not bundle PDFMathTranslate source code. Install and update `pdf2zh` outside this repository, then refresh Settings -> Plugins.

Expected command:

```sh
pdf2zh
```

The plugin is shown as `missingRuntime` until the command is available on `PATH` or in `~/.scribeflow/bin`.

