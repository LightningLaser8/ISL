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
 * An ISL extension. Provides a set of custom keywords, variables, labels and types to an interpreter when imported.
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
   * Adds a new type of value to the extension.
   * @param {string} name Name of this new type.
   * @param {(value) => boolean} validator Function to validate type. Should return true if the input matches type, false if not. If left out, any input will be valid.
   */
  addType(name, validator = (value) => true){
    const type = {name: name, validator: validator}
    this.#types.push(type)
    return type
  }

  /** Quick ways to perform complex or tedious operations with an extension. */
  shortcuts = {
    /**
       * Quick shortcut to enum-style types: Types where a value must be one of a list of options. This isn't actually an enumerated type, but behaves similarly enough.
       * @param {string} name Name of this type.
       * @param {any[]} possibleValues The possible values that are valid for this type. Strings are recommended.
       */
    addEnumType: (name, possibleValues) => {
      const type = {name: name, validator: value => possibleValues.includes(value)}
      this.#types.push(type)
      return type
    },
    /**
     * Shortcut to making types that combine multiple others, with a 'union' operation i.e. any condition can be met.
     * @param {string} name Name of this type.
     * @param  {...{name: string, validator: (value: *) => boolean}} types Type objects to combine into one.
     */
    addCombinedType: (name, ...types) => {
      const type = {name: name, validator: value => {
        for(let type of types){
          if(!type.validator) continue;
          if(type.validator()) return true;
        }
        return false;
      }}
      this.#types.push(type)
      return type
    },
    /**
     * Creates a keyword and global variable that are linked i.e. the keyword sets the global variable's value.
     * @param {*} wordName Name of the keyword.
     * @param {*} varName Name of the global variable.
     * @param {*} initialValue Value that the variable is set to initially.
     * @param {*} type Type of the variable, and the keyword's `value` descriptor.
     */
    addLinkedVariable: (wordName, varName, initialValue, type) => {
      let variable = this.addVariable(varName, initialValue, type)
      this.addKeyword(wordName, function(interpreter, labels, value){
        variable.value = value;
      }, [
        {type: type, name: "value"}
      ])
    },
    /**
     * Adds a keyword to perform a unary operation on a variable's value.
     * @param {string} name Name of the keyword.
     * @param {(value: any) => *} operation Operation to perform on the variable's value. The variable's new value will be the return value of this function.
     */
    addUnaryManipulator: (name, operation) => {
      this.addKeyword(name, function(interpreter, labels, variable){
        interpreter.setVar(variable, operation(interpreter.getVar(variable)))
      },[
        {type: "variable", name: "target"}
      ])
    },
    /**
     * Adds a keyword to perform a binary operation on a variable's value using another value.
     * @param {string} name Name of the keyword.
     * @param {(varValue: any, inValue: any) => *} operation Operation to perform on the variable's value. The variable's new value will be the return value of this function.
     * @param {string} type Type of the other value, for validation. (static types)
     */
    addBinaryManipulator: (name, operation) => {
      this.addKeyword(name, function(interpreter, labels, variable, value){
        interpreter.setVar(variable, operation(interpreter.getVar(variable), value))
      },[
        {type: "variable", name: "target"},
        {type: type, name: "value"},
      ])
    }
  }
}

export { ISLExtension }
