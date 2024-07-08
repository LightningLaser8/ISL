
# **ISL Syntax**

# Basics

## General Syntax
ISL is an assembly-like interpreted language, so each line is its own statement, and is executed independently.  
The general syntax for any statement is   
`[...labels] <keyword> [...parameters]`  
For example,
```
string test
```

The keyword here is `string`, which creates a string variable. Keywords tell the interpreter what it is that the statement is supposed to be doing.  

`test` is the only parameter here. Parameters tell the interpreter what the statement does its thing to, or with. Here,`test` is the name of the variable. 

In another example,
```
left aligned text 100 100 "Hello World"
```
`left` and `aligned` are labels, which change how the keyword `text` is interpreted. THis code will write the text "Hello World" at 100, 100, aligned to the left i.e. 100, 100 ios the middle-left corner.

Some keywords, such as `stop` and `flush`, don't have any parameters at all.  

Any additional unnecessary parameters are ignored.  
Example:  
In the code
```
declare var test extra parameters
```
the words `extra` and `parameters` are unnecessary, as `declare` only takes 2 parameters, so will be ignored.

Sometimes, a keyword will take optional parameters. These can be omitted without crashing, and a default value will be used.

[!] Don't use `declare var`, ISL is statically typed, and `declare var` doesn't set type

## Comments
Anything after a `//` in an ISL statement is considered a comment, so ignored.  

## Backslash Notation
### Variable Getters
Any string `\...\` will be replaced by the value of the variable or function parameter with the name between the slashes.  
There may be more than one getter in a line, e.g. `\a\\b\` is the value of `a` and the value of `b` concatenated.     
Example:  
```
string keys
getkeys keys
log \keys\
flush
```
This ISL will log all currently held keys to the console. Here, `\keys\` is used to access the value of `keys`.

### Explicit References
When a parameter and local variable share a name, which may be inevitable when using external code, the local variable will be overshadowed by the parameter, that is to say `\name\` will be replaced with the parameter's value.  
To get the local variable, prefix the getter with a hyphen (`-`), e.g. `-\name\`. This only gets from local variables. Similarly, though its use case is unknown outside of readability, parameters can be explicitly referenced with a colon prefix: `:\name\`.

### Global variables
Preceded by an underscore in the getter (`\_...\`), these variables cannot be modified directly by ISL, and extensions must be made to create or modify them.  
#### Built-In Globals
`md` Mouse down. `1` if the mouse is currently held down, `0` if not. 

[!] Canvas dependent
`mx` Mouse x position, relative to canvas upper-left corner.  
`my` Mouse x position, relative to canvas upper-left corner.  
 

### Dynamic Keywords
Using getters, arbitrary code can be executed. Take this example:
```
canvas 200 200
string choice
webprompt choice Enter\_\shape
background #000000
if \choice\ = circle jump ~2
jump ~2
filled circle 100 100 30 30
if \choice\ = square jump ~2
jump ~2
filled rectangle 100 100 30 30
if \choice\ = ellipse jump ~2
jump ~2
filled ellipse 100 100 30 30
draw
stop
```
This draws a square if the user enters 'square', and a circle if they enter 'circle'.  
However, the `if` statements take a lot of space, so can be replaced with:
```
canvas 200 200
string choice
webprompt choice Enter\_\shape
background #000000
filled \choice\ 100 100 30 30
draw
stop
```
Here, the value of `choice` is used as a keyword. However, the user could cause an error by inputting anything that isn't a shape, so we'll add a line of validation:
```
canvas 200 200
string choice
webprompt choice Enter\_\shape
background #000000
if \choice\ in [rectangle circle ellipse] filled \choice\ 100 100 30 30
draw
stop
```
This only allows the user to enter 'circle', 'square' or 'ellipse', and draws the shape, but is much more concise than the original code.

### Getter Precedence
Getters are evaluated in a certain order, shown below:  
1. Global variables `\_name\`  
2. Explicit parameters `:\name\`  
3. Explicit local variables `-\name\`  
4. Parameters and local variables `\name\`
   1. Parameters
   2. Local variables

## String Literals
Since ISL uses certain characters to perform functions (e.g. the space character (` `) as a separator), inserting them into strings can be difficult. String literals leave the selection untouched, so the string is preserved.  
They are delimited with double quotes `""`, and the quotes are removed post-processing. Double quotes cannot be used in a string literal, or alone outside one.  
Whilst technically it is possible to use all of Unicode in ISL, avoid doing so, as the JS Interpreter for ISL uses some internally during execution, and using them could cause unexpected behaviour. To protect the interpreter, those characters are removed.

### Inline Variable References
String literals do not allow variable references within them, but sometimes, a dynamically constructed string is required.  
INserting the reference is easy: terminate the string literal, then restart it afterwards: `"text "\variable\" more text"`

## Labels
ISL keywords can be prefixed with a *label*, an aditional keyword to augment the keywords function with.  
Any number of labels are permitted, and in any order. Duplicates are ignored.  
Example:  
```
rectangle 100 100 20 20
```
draws a 20 by 20 rectangle at 100, 100 on the canvas, but it has a fill and an outline. If only the outline is desired, the label `hollow` can be used:
```
hollow rectangle 100 100 20 20
```
Now, only the outline is drawn on the canvas.

## Types
ISL is a statically typed, meaning that variables have one type, which cannot be changed after declaration. The types present in the default interpreter are:  
`string`: A character or line of text.  
`number`: One or more digits.  

Extensions can add additional types.

Most languages have a `boolean` type: either `true` or `false`, but ISL just uses the `number`s `0` and `1`.

# Logic

## Relative Positioning
ISL line numbers can either be a plain number, such as in `jump 5`, which will go to line 5, or they can be relative.  
Relative line numbers are refixed with `~`, and count a number of lines *on top of the current line number*.  
Example:  
```
number input
webprompt input "Input a number"
if input < 10 jump ~3
log "Number greater than 10"
jump ~2
log "Number less than 10"
flush
```
This code will take in a number, check its value against 10, and output if it is bigger or smaller than 10.  
Here, `~2` in `jump` and `~3` in `if...jump` are used to create an if... else statement with relative positioning.

## Interpretation Precedence
Different parts of an ISL statement are processed at different times. This list shows the order of interpretation of ISL constructs:  

0. Illegal character removal
1. String Literal protection `" "`
2. Getters `\...\`
3. Label removal `>label< keyword parameter`
4. Keywords `label >keyword< parameter`
5. String Literal values
6. Parameters and types `label keyword >parameter<`
7. Label effects
8. The actual operation
9. Errors
10. Changes to execution (stopping, `rundelay` etc)

# **ISL Keywords**

# Variables

## Declaration / Creation
Variables are created with static types, and must be declared before attempting to use them.
### Syntax
`number <name>`  
Creates a variable with a value of 0, and type `number`.  

`string <name>`  
Creates a variable with a value of "", and type `string`.  

(deprecated) `declare var <name>`  
Creates a variable with a value of null, and type `undefined`. THis will cause errors everywhere, so don't use it.   

## Deletion
`delete` Deletes a variable, allowing redeclaration.
### Syntax
`delete <variable>`  
Deletes the specified variable.

## Value Setting
`set` Sets a variable's value.
### Syntax
`set <variable> <value>`  
Sets the specified variable's value to the specified value.  

`set <variable>`  
Sets the specified variable's value to null. Acts as a redeclaration.

## Addition
`add` Adds to or concatenates a variable's value with another value.
### Syntax
`add <variable> <value>`  
Adds the specified value to the specified variable's value.  
If one or more of the values are strings, the values will be concatenated instead.

## Subtraction
`subtract` Subtracts a number from a variable's value.
### Syntax
`subtract <variable> <number>`  
Subtracts the specified value from the variable's value.

## Multiplication
`multiply` Multiplies a variable's value by a number.
### Syntax
`multiply <variable> <number>`  
Multiplies the specified variable's value by the specified number.

## Division
`divide` Divides a variable's value by a number.
### Syntax
`divide <variable> <number>`  
Divides the specified variable's value by the specified number.

## Rounding
`round` Rounds a variable to the nearest integer.
### Syntax
`round <variable>`  
Rounds the specified variable to the nearest integer.

## Negation
`negate` Sets a variable to its negative value. e.g. 1 becomes -1, -3.2 becomes 3.2.
### Syntax
`negate <variable>`  
Negates the specified variable.

## Exponentiation
`exponent` Raises a variable's value to the power of a number.
### Syntax
`exponent <variable> <power>`  
Raises the specified variable's value to the specified power. e.g. `exponent x 2` would square `x`.

## Inverse Exponentiation / Roots
`root` Sets a variable's value to the specified root of its current value.
### Syntax
`root <variable> <root>`  
Sets the specified variable's value to the specified root of its current value. e.g. `root x 2` would square root `x`.

# Functions

## Function Creation
`function` can be used to create a function, a block of code that can be called multiple times in one program, and optionally take parameters.
`end` Ends a function declaration.
### Syntax
(deprecated) `declare cmd <name>`  
`function <name> [parameters]`  
Starts a function with the specified name and parameters.  
`end <name>`  
Ends the specified function declaration.
#### Parameters
Each parameter is declared as `name:type`, for example `divisor:number`, where the parameter `divisor` is created as a `number`. The parameter can then be accessed just like a local variable, but read-only. Parameters take precedence over variables.

## Function Execution
`execute` Runs a function, then returns to the line number it was called from, and continues as normal.
### Syntax
`execute <name> [arguments]`  
Runs a function with the specified name, passing in the `arguments` t obe used within the function as parameters..
### Accepted Labels
`default` Uses the default for each type as the parameter, i.e. `0` for number, blank string for a string, etc.

# Flow Control

## Jumping to a Line
`jump` Jumps to a line number.
### Syntax
`jump <line>`  
Jumps to line `line`.
#### Relative Line Numbers
`~<number>` can be used to indicate relative line nmbers, e.g. `~2` indicates 2 lines ahead.

## Stopping Execution
`stop` Halts execution of the program.
### Syntax
`stop`  
Stops the program.

## Restarting Execution
Stops execution, then starts it again at the same speed.  
Restarts from line 1, with all variables cleared.
### Syntax
`restart`  
Jumps to line 1, and deletes all local variables.
### Accepted Labels
`non-destructive` Does not delete local variables. Instead, marks them as re-declareable.

## Pausing Execution
`pause` Pauses execution of the program.  
Does not alter line number or local variables, just simply stops execution.
### Syntax
`pause <timeout>`  
Pauses execution for the specified number of instructions.

## Changing Run Delay
`rundelay` Changes the interpreter's execution speed.
### Syntax
`rundelay <delay>`  
Sets the delay to the specified number of milliseconds.

## Conditional Statements / Selection
`if` Runs an ISL statement if the condition is met.  
### Syntax
`if <value1> <operator> <value2> <code>`  
Runs the code `code` if the condition is met. `code` can be any valid ISL code string.  
Condition is made with `value1`, `value2` and the `operator`.
#### Valid Operators:
- `=` Checks equality. Checks if `value1` is the same as `value2`. Coerces types.
- `<` Checks if `value1` is less than `value2`.
- `>` Checks if `value1` is greater than `value2`.
- `!=` Checks inequality. Checks if `value1` is different to `value2`. Coerces types.
- `in` Checks if the `value1` string appears in `value2`.
#### Chaining
`if` can be chained indefinitely by placing the next statement as the `code` of the last, and all conditions are checked at once.
#### Groups
The `in` operator can take a list or group of items to check exactly against. These groups are denoted by square brackets, and each item is separated by a vertical pipe `|`, i.e. `[item1|item2|"item 3"]`. Everywhere else, this is just a string.


# IO
[!] Most IO ISL requires web-enabled environment. To ensure constant operation, use `{environment: "web"}` or `{environment: "js"}` in the options parameter in the `ISLInterpreter` constructor.

## Message Logging
`log` Logs a message to the interpreter's console.  
`flush` Logs the interpreter's internal console to the browser's console.
### Syntax
`flush`  
Logs all messages in the interpreter's console to the browser's console.  
All `log` statements are put in the same line.
`log <message>`  
Logs a message to the interpreter's console.
### Accepted Labels (`flush`)
`separated` Puts separate log statements in separate lines.

## Awaiting Key Presses / Keyboard Input
`awaitkey` Sets a variable to the next key pressed. Pauses until a key is pressed.
### Syntax
`awaitkey <variable> [type]`
Listens for a key press, then manipulates the specified variable with it.  
`type` can be `set` or `add`, default is `set`

## Getting Key Presses / Keyboard Input
`getkeys` Sets a variable to all currently pressed keys, joined as one string. Does not pause execution.
### Syntax
`getkeys <variable> [type]`
Gets all pressed keys as a string, then manipulates the specified variable with it.  
`type` can be `set` or `add`, default is `set`  
Pressed keys are given as a comma-separated string, e.g. holding 'a', 'b', and 'c' gives `a,b,c`.
### Accepted Labels
`grouped` Gives keys as a group: `[...|...]`

## Prompting / Text Input
`webprompt` Opens the browser's default prompt popup, and assigns a variable to the input.  
### Syntax
`webprompt <variable> <prompt>`  
Opens a popup with the given text to give input. Once the input has been processed, sets the variable to the given value in the prompt.

# Graphics
The use of ISL to create and manipulate a HTML canvas element.
This entire section can be disabled with the `ISLInterpreter.allowIndependentGraphics` option.
## Creating a Canvas
`canvas` Creates a new canvas element, or resizes the existing one.
### Syntax
`canvas <width> <height>`  
Creates a new canvas. If one already exists in the interpreter, it will be resized to the new dimensions.  
Dimensions are `width` by `height`.

## Drawing Rectangles
[!] Requires a canvas to have been made
It's all very well and good having a canvas, but in order for anything to show up, something needs to be drawn.  
`rectangle` Draws a rectangle somewhere on the canvas.
### Syntax
`rectangle <x> <y> <width> <height> [centred]`  
Draws a rectangle at `x`,`y` on the canvas (0,0 is the top-left corner) with width `width` and height `height`.  
### Accepted Labels
`filled` Draws a solid block.  
`hollow` Draws a hollow outline of the rectangle.  
Default is both of the above at once.

## Drawing Circles
[!] Requires a canvas to have been made
Because  r o u n d.
`circle` Draws a circle somewhere on the canvas.
`ellipse` Draws an ellipse; a circle with different width and height.
### Syntax
`circle <x> <y> <radius> [centred]`  
Draws a circle at `x`,`y` on the canvas (0,0 is the top-left corner) with radius `radius`.
`ellipse <x> <y> <width> <height> [centred]`  
Draws an ellipse at `x`,`y` on the canvas (0,0 is the top-left corner) with radii `width` and `height`.
### Accepted Labels
`filled` Draws a solid circle.  
`hollow` Draws a hollow outline of the circle.  
Default is both of the above at once.

## Styling
Does not actually require a canvas.  
This allows you to change what those rectangles look like.
`fill` Sets fill colour  
`outline` Sets outline colour and optionally width.
### Syntax
`fill <colour> [alpha]`  
Sets the fill colour to the specified colour. `colour` can be any CSS colour string, or a hex code in the form `#rrggbb`. `alpha` must be a number between 0 and 255, or not present at all. Only works if `colour` is a hex code.
`outline <colour> <width>`  
Sets the outline colour to the specified colour. `colour` can be any CSS colour string, or a hex code in the form `#rrggbb`.  
If specified, changes the outline width to `width.`
### Accepted Labels
`no` Sets outline width to zero, and colour to transparent. Ignores parameters.

## Transformations
[!] Requires a canvas to have been made
For when rotations are required.  
`save` Saves the current drawing state, including rotations and styles to a stack.  
`restore` Restores the most recently saved state.
### Syntax
`save`   
Saves the current state.  
`restore`   
Restores the most recently saved state.

## Buffered Graphics
If the flickering is annoying (it definitely is), then `ISLInterpreter` has an option, `bufferedGraphics` that adds all draw operations to an array, then draws them all at once.  
`draw` Draws everything in the buffer, and clears it.
### Syntax
`draw`  
Draws everything in the buffer at once.

# Program Interface

## In- and Exporting
`import` Sets a local variable's value to an external one.  
`export` Sets an external variable's value to an internal one.  
For security, the `ISLInterpreter.allowExport` and `ISLInterpreter.allowImport` options can be set to false to disable exporting and importing, respectively.  
Both `import` and `export` can only access global variables, in JavaScript's case, declared with `var`, not `let` or `const`.
### Syntax
`export <local-variable> <external-variable>`   
Changes the specified external variable to the value of the specified local variable.  
`import <external-variable> <local-variable>`  
Changes the specified local variable to the value of the specified external variable.  

# Meta Tags
Meta tags are a way of adding extra info to an ISL program, to change what the interpreter does with it.  
They are always surrounded by [square brackets] and are placed alone on a line, without any keywords. They cannot have dynamic values (i.e. using `\variable references\`)
## Requiring Extensions
If an ISL program is made with a certain extension in mind, using a `require` tag can make sure that all users import that extension. If the file is run with a `require` tag, and the interpreter doesn't have the extension, an `Error` will be thrown.
### Syntax
`[require <extension>]`  
Flags that the file requires the specified extension. 
### Multiple Tags 
Multiple `require` tags will check for all the extensions specified.

## Setting Environment
Some features of basic ISL and extensions require certain environments to work, and throw errors if they're in the wrong one. However, this is only after the rest of the program has run, so can be wasteful. `environment` or `env` tags are used to declare the environment to the interpreter, so it can throw errors early.
### Syntax
`[environment <environment>]`  
`[env <environment>]`  
Throws an error if the interpreter's environment doesn't match the specified one.
### Multiple Tags 
Adding this tag multiple times will require all environments at once, which is impossible, so an error will be thrown regardless.

## Ignoring Keywords
`ignore` tags can be used to effectively 'comment out' entire keywords, and stop them being parsed.
### Syntax
`[ignore <...keywords>]`  
Adds the keyword(s) to the ignore list. Ignored keywords are passed over during interpretation. Can take a list of keywords, for example `[ignore add subtract multiply divide]` will ignore the keywords `add`, `subtract`, `multiply` and `divide`.
### Multiple Tags 
Multiple `ignore` tags will add all the tags to the ignore list.

# **Advanced**
# Extensions
ISL Extensions are made with the `ISLExtension` class, provided in the core. They contain any number of custom keywords and global variables that can then be imported into an interpreter.
## Creating
[!] Requires module `core\extensions`
THe best way to learn this, is by example, so this section will create a new extension, `multiplier` which adds 2 keywords, `mult` and `multiplier`, and a global variable, `\_multi\`, which `multiplier` modifies.

First, create a new `.js` file, and open it in an IDE of your choice. We'll call it `multiplier.js`.
Creating an extension requires the `ISLExtension` class from module `core\extensions`, so, first, import `ISLExtension` from the `core` module of ISL.
```
import ISLExtension from "./isl/core/extensions.js"
```
Now, instantiate `ISLExtension` as a constant. `ISLExtension` takes one parameter, `identifier`, which will be used to identify it. We will be using `multiplier` as the identifier.
```
import ISLExtension from "./isl/core/extensions.js"
const ext = new ISLExtension("multiplier")
```
Now we have a blank extension. Time to add a variable, using the `ISLExtension.addVariable()` method:
```
import ISLExtension from "./isl/core/extensions.js"
const ext = new ISLExtension("multiplier")
ext.addVariable("multi", 1)
```
The extension now has a variable: `multi`, with a default value of `1`. However, it's pretty useless right now, so let's add a keyword to change it, using the `ISLExtension.addKeyword()` method.
```
import ISLExtension from "./isl/core/extensions.js"
const ext = new ISLExtension("multiplier")
ext.addVariable("multi", 1)
ext.addKeyword("mult", function(labels, newMult){/* Now what?*/})
```
The callback is sent the current labels of the keyword as an array in the first parameter, `labels`
But, there's a problem! `ISLInterpreter` has no method to access global variables, and they're private properties!
To get around this, `ISLExtension.addVariable()` returns the variable made, so the code becomes
```
import ISLExtension from "./isl/core/extensions.js"
const ext = new ISLExtension("multiplier")
let multi = ext.addVariable("multi", 1)
ext.addKeyword("multiplier",
  function(labels, newMult){
    multi.value = newMult
  }
)
```
Now, our extension has the keyword `multiplier`, which takes one argument: `newMult`, the new multiplier. Any interpreter with this extension will now read `multiplier 4` as "set the global variable `multi`'s value to `4`".  
Now, let's give the extension some actual functionality. As this is an example, we'll keep it simple, but there's no real limit to how much you can add.
```
import ISLExtension from "./isl/core/extensions.js"
const ext = new ISLExtension("multiplier")
let multi = ext.addVariable("multi", 1)
ext.addKeyword("multiplier",
  function(labels, newMult){
    multi.value = newMult
  }
)
ext.addKeyword("mult",
  function(labels, variable){
    this.setVar(variable, this.getVar(variable) * multi)
  }
)
```
The keyword `mult` will multiply a variable's value by the stored multiplier, `multi`.  
Now, it's time to export the new extension. We'll use `export default` to keep imports nice and concise, and as we're exporting only one thing.
```
import ISLExtension from "./isl/core/extensions.js"
const ext = new ISLExtension("multiplier")
let multi = ext.addVariable("multi", 1)
ext.addKeyword("multiplier",
  function(labels, newMult){
    multi.value = newMult
  }
)
ext.addKeyword("mult",
  function(labels, variable){
    this.setVar(variable, this.getVar(variable) * multi)
  }
)
export default ext
```
To use this, however, we'll need to import it into an interpreter. We'll assume there is already an ISL-enabled program (it's simple, but not relevant to this example), with an interpreter stored in `interpreter`.  
In that file, import your extension:
```
import ext from "./multiplier.js"
```
Then call `ISLInterpreter.extend()` on the interpreter:
```
import ext from "./multiplier.js"
interpreter.extend(ext)
```
That's it! You've created 2 new ISL keywords, both getting and setting a global variable, and applied them to an ISL interpreter. Remember to add `[require multiplier]` to the top of any ISL files, to tell users (and interpreters) that they need your `multiplier` extension to run it.
## Importing
`ISLInterpreter.extend()` can be used to import an extension's content to the interpreter. Imported extensions apply to that  interpreter only.
## Reference
### ISLInterpreter.extend()
Imports an `ISLExtension` into the interpreter, copying its keywords, labels, functions and types.  
```
ISLInterpreter.extend(extension: ISLExtension)
```
#### extension
Extension to import.

### ISLExtension.addKeyword()
Adds a custom keyword to the extension.
```
ISLExtension.addKeyword(name: string, callback: Function)
```
#### name
The name of the keyword.
#### callback


### ISLExtension.addVariable()
Adds a custom variable to the extension.
The only dynamically typed part of ISL.
```
ISLExtension.addVariable(name: string, initialValue: any)
```
#### name
Name/identifier of the variable.
#### initialValue
Initial value of the variable.

### ISLExtension.addLabel()
Adds a custom label to the extension.
```
ISLExtension.addLabel(name: string, for: Array<string>)
```
#### name
Name of the label.
#### for
Array of keywords the label is applicable to.