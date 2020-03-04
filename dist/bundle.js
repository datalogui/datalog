magic =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/index.ts");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
/*! no exports provided */
/***/ (function(module, exports) {

eval("throw new Error(\"Module build failed (from ./node_modules/babel-loader/lib/index.js):\\nSyntaxError: /Users/marcomunizaga/code/datalog-js/src/index.ts: Unexpected token, expected \\\")\\\" (72:55)\\n\\n\\u001b[0m \\u001b[90m 70 | \\u001b[39m    \\u001b[36mfor\\u001b[39m (\\u001b[36mconst\\u001b[39m m of person({ name\\u001b[33m:\\u001b[39m \\u001b[32m\\\"marco\\\"\\u001b[39m })\\u001b[33m.\\u001b[39mintersect(parentOf)) {\\u001b[0m\\n\\u001b[0m \\u001b[90m 71 | \\u001b[39m        \\u001b[36mfor\\u001b[39m (\\u001b[36mconst\\u001b[39m p of parentOf({ child\\u001b[33m:\\u001b[39m m })\\u001b[33m.\\u001b[39mintersect(person)) {\\u001b[0m\\n\\u001b[0m\\u001b[31m\\u001b[1m>\\u001b[22m\\u001b[39m\\u001b[90m 72 | \\u001b[39m            \\u001b[36mfor\\u001b[39m (\\u001b[36mconst\\u001b[39m parentName of person({ id\\u001b[33m:\\u001b[39m p }) {\\u001b[0m\\n\\u001b[0m \\u001b[90m    | \\u001b[39m                                                       \\u001b[31m\\u001b[1m^\\u001b[22m\\u001b[39m\\u001b[0m\\n\\u001b[0m \\u001b[90m 73 | \\u001b[39m                out\\u001b[33m.\\u001b[39mpush([parentName\\u001b[33m,\\u001b[39m p\\u001b[33m,\\u001b[39m m])\\u001b[0m\\n\\u001b[0m \\u001b[90m 74 | \\u001b[39m            }\\u001b[0m\\n\\u001b[0m \\u001b[90m 75 | \\u001b[39m        }\\u001b[0m\\n    at Object.raise (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:7044:17)\\n    at Object.unexpected (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:8422:16)\\n    at Object.expect (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:8408:28)\\n    at Object.parseForIn (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11356:10)\\n    at Object.parseForStatement (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11039:21)\\n    at Object.parseStatementContent (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10749:21)\\n    at Object.parseStatementContent (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:6002:18)\\n    at Object.parseStatement (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10724:17)\\n    at Object.parseBlockOrModuleBlockBody (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11298:25)\\n    at Object.parseBlockBody (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11285:10)\\n    at Object.parseBlock (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11269:10)\\n    at Object.parseStatementContent (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10800:21)\\n    at Object.parseStatementContent (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:6002:18)\\n    at Object.parseStatement (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10724:17)\\n    at /Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11357:60\\n    at Object.withTopicForbiddingContext (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10599:14)\\n    at Object.parseForIn (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11357:22)\\n    at Object.parseForStatement (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11039:21)\\n    at Object.parseStatementContent (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10749:21)\\n    at Object.parseStatementContent (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:6002:18)\\n    at Object.parseStatement (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10724:17)\\n    at Object.parseBlockOrModuleBlockBody (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11298:25)\\n    at Object.parseBlockBody (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11285:10)\\n    at Object.parseBlock (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11269:10)\\n    at Object.parseStatementContent (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10800:21)\\n    at Object.parseStatementContent (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:6002:18)\\n    at Object.parseStatement (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10724:17)\\n    at /Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11357:60\\n    at Object.withTopicForbiddingContext (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:10599:14)\\n    at Object.parseForIn (/Users/marcomunizaga/code/datalog-js/node_modules/@babel/parser/lib/index.js:11357:22)\");\n\n//# sourceURL=webpack://magic/./src/index.ts?");

/***/ })

/******/ });