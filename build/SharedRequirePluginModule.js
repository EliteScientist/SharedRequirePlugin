"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _SharedRequirePluginModule_compatibility, _SharedRequirePluginModule_requireFunction;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedRequirePluginModule = void 0;
const webpack_1 = require("webpack");
class SharedRequirePluginModule extends webpack_1.RuntimeModule {
    constructor(requireFunction, compatability = false) {
        super("SharedRequirePlugin", webpack_1.RuntimeModule.STAGE_ATTACH);
        _SharedRequirePluginModule_compatibility.set(this, void 0);
        _SharedRequirePluginModule_requireFunction.set(this, void 0);
        __classPrivateFieldSet(this, _SharedRequirePluginModule_requireFunction, requireFunction, "f");
        __classPrivateFieldSet(this, _SharedRequirePluginModule_compatibility, compatability, "f");
    }
    shouldIsolate() {
        return true;
    }
    generate() {
        const buf = [];
        buf.push("// Shared-Require Global Module Provider Function");
        buf.push(`${webpack_1.RuntimeGlobals.global}.${__classPrivateFieldGet(this, _SharedRequirePluginModule_requireFunction, "f")} = function (moduleId)`);
        buf.push("{");
        buf.push(webpack_1.Template.indent(`return ${webpack_1.RuntimeGlobals.require}(moduleId);`));
        buf.push("}");
        if (__classPrivateFieldGet(this, _SharedRequirePluginModule_compatibility, "f")) {
            buf.push("");
            buf.push("// Shared-Require Backwards Compatiblity");
            buf.push(`Object.defineProperty(${webpack_1.RuntimeGlobals.global}, "globalSharedModules",`);
            buf.push("{");
            buf.push(webpack_1.Template.indent([
                "get: function()",
                "{",
                webpack_1.Template.indent(`if (!${webpack_1.RuntimeGlobals.global}._globalSharedModules)`),
                webpack_1.Template.indent("{"),
                webpack_1.Template.indent(webpack_1.Template.indent(`${webpack_1.RuntimeGlobals.global}._globalSharedModules	= new Proxy(${webpack_1.RuntimeGlobals.moduleFactories},`)),
                webpack_1.Template.indent(webpack_1.Template.indent("{")),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("get: function (target, prop, receiver)"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("{"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("if (isNaN(prop))")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("return target[prop];"))))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("return null;")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("},"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("has: function (target, prop)"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("{"))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("if (isNaN(prop))")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("return prop in target;"))))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("return false;")))),
                webpack_1.Template.indent(webpack_1.Template.indent(webpack_1.Template.indent("}"))),
                webpack_1.Template.indent(webpack_1.Template.indent("});")),
                webpack_1.Template.indent("}"),
                webpack_1.Template.indent(""),
                webpack_1.Template.indent(`return ${webpack_1.RuntimeGlobals.global}._globalSharedModules;`),
                "},",
                "configurable: true"
            ]));
            buf.push("});");
        }
        return webpack_1.Template.asString(buf);
    }
}
exports.SharedRequirePluginModule = SharedRequirePluginModule;
_SharedRequirePluginModule_compatibility = new WeakMap(), _SharedRequirePluginModule_requireFunction = new WeakMap();
