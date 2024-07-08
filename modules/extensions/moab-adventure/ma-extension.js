/*
  __  __    ____    ____   ____
 /  \/  \  /    \  / __ \  | _ \
| ||__|| | | () | | |__| | | _ <
|_|    |_| \____/ |_/--\_| |___/ ()
Just m o a b. That's all there is to it.
*/
//ISL Extension
import ISLExtension from "../../../core/extensions.js"

const MA_EXTENSION = new ISLExtension("ma-js")
const MAE = MA_EXTENSION
let spd = MAE.addVariable("speed", 2)
MAE.addKeyword("speed", function(speed){spd.value = speed})

export default MA_EXTENSION