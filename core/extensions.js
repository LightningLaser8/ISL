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
  #types = {}
  #labels = []
  #identifier = ""
  /**
   * @param {String} id Identifier for the extension, used in ISL meta tags for dependency
   */
  constructor(id){this.#identifier = id}// oh, come onnnnn
  /**  */
  get types(){return this.#types}
  get labels(){return this.#labels}
  get keywords(){return this.#keywords}
  get variables(){return this.#variables}
  get id(){return this.#identifier}

  /**
   * Adds a custom keyword to this extension. Does not automatically validate inputs.
   * @param {string} name Name of the keyword. What you will actually have to type in to use the keyword.
   * @param {Function} callback Function to execute. Inputs are given as a list of function arguments after the second. The first parameter is the interpreter. The second parameter is an Array of the current labels. To get a variable value in this, call `(interpreter).getVar(name)`. To set a variable, call `(interpreter).setVar(name, value)`. `this` refers to the extension the keyword was loaded from. Cannot be an arrow function!
   * @example <caption>Creates the keyword `double`, which doubles a variable's value. Accepts one string input - `varName` - the variable name.</caption>
   * -addKeyword(
     -  "double",
     -  function(interpreter, labels, varName) {
     -    interpreter.setVar(
     -      varName[0],
     -      interpreter.getVar(varName) * 2
     -    )
     -  }
     -})
   */
  addKeyword(name, callback){
    const obj = {callback: callback}
    this.#keywords[name] = obj
  }
  /**
   * Adds a variable to be turned into a global variable on import.
   * @param {string} name The name of the global variable. What the interpreter should look out for.
   * @param {any} value Initial value of the variable.
   * @returns the ISL variable object created, for further use
   */
  addVariable(name, value){
    const obj = {value: value, type: typeof value}
    this.#variables[name] = obj
    return obj
  }
  /**
   * Adds a label for keywords.
   * @param {string} name The name of the label. What the interpreter should look out for.
   * @param {Array<string>} wordsFor Keywords this label is for.
   */
  addLabel(name, wordsFor){
    const obj = {label: name, for: [...wordsFor]}
    this.#labels.push(obj)
  }
}

export { ISLExtension }
