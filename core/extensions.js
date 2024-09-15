/*
 _______     ______     __
|__   __|   /  __  \   |  |
   | |     |  |  \_/   |  |
   | |      \  \__     |  |
   | |       _\__ \    |  |
 __| |__    / \__| \   |  |____
|_______|   \______/   |_______|

[Infinity] Interpreted Sequence Language

Extension API.
Extensions can provide keywords, labels, variables and types to an ISL interpreter.
*/
/**
 * An ISL extension. Provides a set of custom keywords, variables and types to an interpreter when imported.
 */
class ISLExtension{
  #keywords = {}
  #variables = {}
  #types = []
  #labels = []
  #identifier = ""
  /**
   * @param {string} id Identifier for the extension, used in ISL meta tags for dependency
   */
  constructor(id){this.#identifier = id}
  /**  */
  get types(){return this.#types}
  get labels(){return this.#labels}
  get keywords(){return this.#keywords}
  get variables(){return this.#variables}
  get id(){return this.#identifier}

  /**
   * Adds a custom keyword to this extension.
   * @param {string} name Name of the keyword. What you will actually have to type in to use the keyword.
   * @param {Function} callback Function to execute. Inputs are given as a list of function arguments after the second. The first parameter is the interpreter. The second parameter is an Array of the current labels. To get a variable value in this, call `(interpreter).getVar(name)`. To set a variable, call `(interpreter).setVar(name, value)`. `this` refers to the extension the keyword was loaded from. Cannot be an arrow function!
   * @param {{type: string, name: string}[]} descriptors Describe the ISL inputs, including type, display name (for errors and such), and other metadata. If left blank for any input, it is treated as an optional string. If present, will be used for automatic validation.
   * @example <caption>Creates the keyword `double`, which doubles a variable's value. Accepts one 'variable' input - `varName` - the variable name.</caption>
   * -addKeyword(
     -  "double",
     -  function(interpreter, labels, varName) {
     -    interpreter.setVar(
     -      varName,
     -      interpreter.getVar(varName) * 2
     -    )
     -  },
     -  [
     -    {type: "variable", name: "variable"}
     -  ]
     -})
   */
  addKeyword(name, callback, descriptors){
    this.#keywords[name] = {callback: callback, descriptors: descriptors}
  }
  /**
   * Adds a variable to be turned into a global variable on import.
   * @param {string} name The name of the global variable. What the interpreter should look out for.
   * @param {any} value Initial value of the variable.
   * @param {string} type Optional type override. If left blank, type is inferred from `value`.
   * @returns the ISL variable object created, for further use
   */
  addVariable(name, value, type = typeof value){
    const obj = {value: value, type: type}
    this.#variables[name] = obj
    return obj
  }
  /**
   * Adds a label for keywords.
   * @param {string} name The name of the label. What the interpreter should look out for.
   * @param {Array<string>} wordsFor Keywords this label is for.
   */
  addLabel(name, wordsFor){
    this.#labels.push({label: name, for: [...wordsFor]})
  }
  /**
   * 
   * @param {string} name Name of this new type.
   * @param {(value) => boolean} validator Function to validate type. Should return true if the input matches type, false if not. If left out, any input will be valid.
   */
  addType(name, validator = (value) => true){
    this.#types.push({name: name, validator: validator})
  }
}

export { ISLExtension }
