import ISLInterpreter from "../../../core/interpreter.js";
import MAJS from "./ma-extension.js"
/** ISL Interpreter for MOAB Adventure. Contains the default MA extension, and overrides the `environment` option. */
class MAInterpreter extends ISLInterpreter{
  constructor(options){
    let newOpts = options
    Object.assign(newOpts, {environment: "moab-adventure-js"})
    super(newOpts)
    this.extend(MAJS)
  }
}
export default MAInterpreter