/*
 _______     ______     __
|__   __|   /  __  \   |  |
   | |     |  |  \_/   |  |
   | |      \  \__     |  |
   | |       _\__ \    |  |
 __| |__    / \__| \   |  |____
|_______|   \______/   |_______|

[Infinity] Interpreted Sequence Language

Extension loading helper.
*/
import { ISLInterpreter } from "../../core/interpreter.js";

async function extendInterpreterFromFile(interpreter, path) {
  const result = await loadExtensionsFromFile(path);
  for (let extension of result) {
    if (extension.isClass) {
      Object.defineProperty(extension.ext.prototype, "source", {
        value: extension.url,
      });
      interpreter.classExtend(extension.ext);
    } else {
      Object.defineProperty(extension.ext, "source", { value: extension.url });
      interpreter.extend(extension.ext);
    }
  }
  return true;
}

async function extendInterpreterDirectly(interpreter, data) {
  const result = await loadExtensionsDirectly(data);
  for (let extension of result) {
    if (extension.isClass) {
      interpreter.classExtend(extension.ext);
    } else {
      interpreter.extend(extension.ext);
    }
  }
  return true;
}

async function loadExtensionsFromFile(path) {
  const imported = await import("" + path, { with: { type: "json" } });
  const data = imported["default"];
  return await retrieveAll(data);
}

async function loadExtensionsDirectly(data) {
  return await retrieve(data);
}

async function retrieveAll(data) {
  if (!Array.isArray(data))
    throw new TypeError("Object or file does not contain an array!");
  const extensions = [];
  for (let request of data) {
    extensions.push(...(await getExtensions(request.url, request.extensions)));
  }
  return extensions;
}

async function retrieve(data) {
  if (!data.url) throw new TypeError("Object has no URL to look at!");
  if (!data.extensions)
    throw new TypeError("Object has no extensions to look for!");
  return await getExtensions(data.url, data.extensions);
}

async function getExtensions(
  url,
  extensionList,
  messageOut = (msg) => {
    console.log(msg);
  }
) {
  const start = Date.now();
  const extensions = [];
  if ([".", "/"].includes(url.trim()[0]))
    console.warn("Relative URLs (" + url + ") should not be used.");
  if (extensionList === "*") {
    try {
      const out = await requestModule(url);
      messageOut(
        out.length +
          " extensions retrieved in " +
          (Date.now() - start) +
          "ms: " +
          out.map((x) => x.name + " (id " + x.id + ")").toString()
      );
      extensions.push(...out);
    } catch (error) {
      messageOut("Error importing extensions from " + url + ": " + error);
    }
  } else {
    try {
      if (!extensionList) throw new TypeError("No extension list defined!");
      if (!Array.isArray(extensionList))
        throw new TypeError("Extension list is not an array!");
      for (let extRequest of extensionList) {
        const out = await requestSpecificExtension(url, extRequest);
        messageOut(
          "Extension '" +
            out.name +
            "' (id " +
            out.id +
            ") retrieved in " +
            (Date.now() - start) +
            "ms"
        );
        extensions.push(out);
      }
    } catch (error) {
      messageOut(
        "Error importing " + extensionList + " from " + url + ": " + error
      );
    }
  }
  return extensions;
}

async function requestModule(url) {
  return new Promise((resolve, reject) => {
    import("" + url).then(
      (module) => {
        const imported = [];
        for (let extName in module) {
          const extension = module[extName];
          if (extension) {
            if (isClass(extension)) {
              if (extension.__proto__.name === "ISLExtension") {
                const instance = new extension(new ISLInterpreter());
                imported.push({
                  ext: extension,
                  name: extName,
                  id: instance.id,
                  isClass: true,
                  url: url,
                });
              }
            } else if (extension[Symbol.toStringTag] === "ISLExtension") {
              imported.push({
                ext: extension,
                name: extName,
                id: extension.id,
                isClass: false,
                url: url,
              });
            }
          }
          if (imported.length === 0) {
            reject("No ISL Extensions in module");
          } else {
            resolve(imported);
          }
        }
      },
      (reason) => {
        reject(
          "Could not import from " +
            url +
            ": " +
            (URL.canParse(url) ? "Unreachable / Not found" : "Invalid URL")
        );
      }
    );
  });
}

async function requestSpecificExtension(url, extName) {
  return new Promise((resolve, reject) => {
    import("" + url).then(
      (module) => {
        const extension = module[extName];
        if (extension) {
          if (isClass(extension)) {
            if (!(extension.__proto__.name === "ISLExtension")) {
              reject(
                "Imported class " + extension.name + " is not an extension"
              );
            } else {
              const instance = new extension(new ISLInterpreter());
              resolve({
                ext: extension,
                name: extName,
                id: instance.id,
                isClass: true,
                url: url,
              });
            }
          } else if (extension[Symbol.toStringTag] === "ISLExtension") {
            resolve({
              ext: extension,
              name: extName,
              id: extension.id,
              isClass: false,
              url: url,
            });
          } else {
            reject(
              "Imported object is neither a class nor an instance of ISLExtension."
            );
          }
        } else {
          reject("Property " + extName + " does not exist in module.");
        }
      },
      (reason) => {
        reject(
          "Could not import from " +
            url +
            ": " +
            (URL.canParse(url) ? "Unreachable / Not found" : "Invalid URL")
        );
      }
    );
  });
}

function isClass(v) {
  return typeof v === "function" && /^\s*class\s+/.test(v.toString());
}
/**
 * Extension loader. Loads from a JSON file with a single array of objects, or from one object.
 * These objects should each have 2 properties: `url` and `extensions`.
 * `url` should be a string, and be a CDN link to a module exporting at least one ISL extension.
 * `extensions` should either be an array of strings representing names of exported extensions, or the single character `*`, meaning "any that can be found".
 *
 * All methods are asynchronous.
 */
const ExtensionLoader = {};
ExtensionLoader.file = {};
/**
 * Extends an interpreter asynchronously, using extension data from a JSON file.
 * @param {ISLInterpreter} interpreter ISL Interpreter to use.
 * @param {string | URL} path Path to the file.
 */
ExtensionLoader.fileExtend = extendInterpreterFromFile;
/**
 * Loads extensions asynchronously, using extension data from a JSON file.
 * @param {*} path JSON file to load with.
 * @returns {Array<ISLExtension | class<ISLExtension>>} Extensions (or extension classes) found.
 */
ExtensionLoader.fileLoad = loadExtensionsFromFile;
/**
 * Extends an interpreter asynchronously, using extension data from an object.
 * @param {ISLInterpreter} interpreter ISL Interpreter to extend.
 * @param {{url: string, extension: "*" | string[]}} data Extension URLs and names to load.
 */
ExtensionLoader.extend = extendInterpreterDirectly;
/**
 * Loads extensions asynchronously, using extension data from a JSON file.
 * @param {{url: string, extension: "*" | string[]}} data Extension URLs and names to load.
 * @returns {(ISLExtension | class<ISLExtension>)[]} Extensions (or extension classes) found.
 */
ExtensionLoader.load = loadExtensionsDirectly;

export { ExtensionLoader };
