# ISL Module: File Loader
Provides a simple file loader using an HTML input element. Can also read files on server-side.
Has the ability to create a file input, if one is not provided.
## Loading From HTML Input
First, create a new `ISLFileLoader` object. This will be the file reader.
### Setting up File Input
To create the input element, call `setupInput()`, passing in the `HTMLInputElement` to use as the input, or the id of it. If there is no such element with this id, the loader will throw a `ReferenceError`. If no parameters are passed in, the loader will create a new element, and insert it after the `<script></script>` element. In this case, `setupInput()` will return an `HTMLDivElement` containing the input, the label for it, and the default style.
### Automatic Run
Automatic run (auto-run) is a feature of the loader which allows linking of an interpreter to the loader, then running the loaded ISL on it immediately. To enable it, call `setupAutoRun()`, passing in the interpreter to run the ISL on. THis behaviour can then be disabled using the `ISLFileLoader.runOnLoad` property.