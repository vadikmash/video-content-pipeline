/**
 * Static preflight for authored sequence modules. It parses (never executes) the
 * source and rejects anything outside the authored-module contract: imports
 * other than `react` and `@vcp/motion`, dynamic loading, I/O and network
 * globals, time-dependent or unseeded calls, raw HTML/script, external resource
 * URLs and frame-to-frame state. The container boundary still applies to
 * everything that passes; this check gives the author precise repair feedback.
 */
import ts from "typescript";

export const MAX_SOURCE_BYTES = 64 * 1024;
export const ALLOWED_MODULES = new Set(["react", "@vcp/motion"]);

export interface PreflightIssue { message: string; line: number; column: number }
export type PreflightResult = { ok: true } | { ok: false; issues: PreflightIssue[] };

const FORBIDDEN_GLOBALS = new Set([
  "eval", "Function", "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker",
  "ServiceWorker", "importScripts", "navigator", "window", "document", "globalThis", "self", "top", "parent",
  "frames", "location", "history", "localStorage", "sessionStorage", "indexedDB", "caches", "cookieStore",
  "process", "require", "module", "exports", "__dirname", "__filename", "global", "Buffer",
  "Date", "performance", "setTimeout", "setInterval", "setImmediate", "clearTimeout", "clearInterval",
  "requestAnimationFrame", "requestIdleCallback", "queueMicrotask", "Image", "Audio", "Blob", "File",
  "FileReader", "URL", "Request", "Response", "Headers", "FormData", "Proxy", "Reflect", "WebAssembly",
  "crypto", "Atomics", "SharedArrayBuffer", "alert", "confirm", "prompt", "open", "close", "postMessage",
  "Notification", "BroadcastChannel", "MessageChannel", "OffscreenCanvas", "createImageBitmap", "Symbol",
  "delayRender", "continueRender", "staticFile",
]);

/** Property names that reach constructors, prototypes or host objects. */
const FORBIDDEN_PROPERTIES = new Set([
  "constructor", "__proto__", "prototype", "__defineGetter__", "__defineSetter__", "__lookupGetter__",
  "__lookupSetter__", "defineProperty", "setPrototypeOf", "getPrototypeOf", "random", "now",
  "innerHTML", "outerHTML", "insertAdjacentHTML", "ownerDocument", "contentWindow", "contentDocument",
]);

/** React APIs that hold state between frames or reach outside render. */
const FORBIDDEN_REACT = new Set([
  "useState", "useReducer", "useRef", "useEffect", "useLayoutEffect", "useInsertionEffect",
  "useSyncExternalStore", "useTransition", "useDeferredValue", "useActionState", "useOptimistic",
  "use", "createRef", "Component", "PureComponent", "createPortal", "cache", "lazy", "Suspense",
]);

const FORBIDDEN_ELEMENTS = new Set([
  "script", "iframe", "object", "embed", "img", "image", "video", "audio", "source", "track", "picture",
  "link", "style", "meta", "base", "foreignObject", "a", "form", "input", "textarea", "button", "canvas",
  "feImage", "animate", "animateMotion", "animateTransform", "set", "discard", "portal", "frame", "frameset",
]);

const URL_ATTRIBUTES = new Set(["href", "xlinkHref", "xlink:href", "src", "srcSet", "action", "formAction", "poster", "data"]);
const EXTERNAL = /(?:\b(?:https?|wss?|ftp|file|data|blob|javascript|chrome|about):|\/\/[\w.-]|@import|\burl\(\s*['"]?(?!#))/i;

function position(source: ts.SourceFile, node: ts.Node | number) {
  const at = typeof node === "number" ? node : node.getStart(source);
  const { line, character } = source.getLineAndCharacterOfPosition(at);
  return { line: line + 1, column: character + 1 };
}

export function preflight(source: string, fileName = "sequence.tsx"): PreflightResult {
  const issues: PreflightIssue[] = [];
  const bytes = Buffer.byteLength(source, "utf8");
  if (bytes > MAX_SOURCE_BYTES) return { ok: false, issues: [{ message: `Source is ${bytes} bytes; the limit is ${MAX_SOURCE_BYTES}`, line: 1, column: 1 }] };
  if (source.includes("\u0000")) return { ok: false, issues: [{ message: "Source contains a NUL character", line: 1, column: 1 }] };

  const syntax = ts.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  // A lib-free program binds local declarations only, so any name that resolves
  // to nothing in this file is a global reference.
  const host = ts.createCompilerHost({ noLib: true });
  const program = ts.createProgram({
    rootNames: [fileName],
    options: { noLib: true, noResolve: true, jsx: ts.JsxEmit.ReactJSX, allowJs: false, types: [] },
    host: { ...host, getSourceFile: (name) => (name === fileName ? file : undefined), fileExists: (name) => name === fileName, readFile: () => undefined },
  });
  const checker = program.getTypeChecker();
  const isLocal = (node: ts.Identifier) => {
    const symbol = checker.getSymbolAtLocation(node);
    return Boolean(symbol?.declarations?.some((d) => d.getSourceFile() === file && !ts.isImportSpecifier(d) && !ts.isImportClause(d) && !ts.isNamespaceImport(d)));
  };
  for (const diagnostic of syntax.diagnostics ?? []) {
    const where = diagnostic.start === undefined ? { line: 1, column: 1 } : position(file, diagnostic.start);
    issues.push({ message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"), ...where });
  }
  if (issues.length) return { ok: false, issues };

  const report = (node: ts.Node, message: string) => issues.push({ message, ...position(file, node) });
  const reactAliases = new Map<string, string>();
  let reactNamespace: string | undefined;
  let defaultExports = 0;

  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = (statement.moduleSpecifier as ts.StringLiteral).text;
      if (!ALLOWED_MODULES.has(specifier)) {
        report(statement, `Import from "${specifier}" is not allowed; use only "react" and "@vcp/motion"`);
        continue;
      }
      const clause = statement.importClause;
      if (specifier === "react" && clause) {
        if (clause.name) reactNamespace = clause.name.text;
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) reactNamespace = bindings.name.text;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            const imported = (element.propertyName ?? element.name).text;
            if (FORBIDDEN_REACT.has(imported)) report(element, `React ${imported} is not allowed; derive everything from the frame`);
            reactAliases.set(element.name.text, imported);
          }
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      defaultExports++;
      if (statement.isExportEquals) report(statement, "Use `export default`, not `export =`");
    } else if (ts.isExportDeclaration(statement)) {
      report(statement, "Re-exports are not allowed; export one default sequence component");
    } else if (ts.isImportEqualsDeclaration(statement)) {
      report(statement, "`import = require` is not allowed");
    } else if (ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement) || ts.isClassDeclaration(statement)) {
      const modifiers = ts.getModifiers(statement) ?? [];
      const exported = modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const isDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (exported && isDefault) {
        defaultExports++;
        if (!ts.isFunctionDeclaration(statement)) report(statement, "The default export must be a function component");
      } else if (exported) {
        report(statement, "Only the default sequence component may be exported");
      }
    }
  }
  if (defaultExports !== 1) report(file, "Export exactly one default sequence component: `export default function Sequence(props: SequenceProps)`");

  const visit = (node: ts.Node): void => {
    switch (node.kind) {
      case ts.SyntaxKind.WithStatement:
      case ts.SyntaxKind.DebuggerStatement:
        report(node, `${ts.SyntaxKind[node.kind]} is not allowed`);
        break;
      case ts.SyntaxKind.ClassDeclaration:
      case ts.SyntaxKind.ClassExpression:
        report(node, "Classes are not allowed; use function components and helpers");
        break;
      case ts.SyntaxKind.AwaitExpression:
      case ts.SyntaxKind.YieldExpression:
        report(node, "Asynchronous code is not allowed; a sequence renders synchronously from the frame");
        break;
      case ts.SyntaxKind.MetaProperty:
        report(node, "`import.meta` and `new.target` are not allowed");
        break;
    }
    if (ts.isFunctionLike(node) && ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) report(node, "Async functions are not allowed");
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) report(node, "Dynamic import is not allowed");

    if (ts.isIdentifier(node)) checkIdentifier(node);
    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.text;
      if (FORBIDDEN_PROPERTIES.has(name)) report(node.name, `Access to .${name} is not allowed${name === "random" ? "; use random(seed, ...) from @vcp/motion" : ""}`);
      if (reactNamespace && ts.isIdentifier(node.expression) && node.expression.text === reactNamespace && FORBIDDEN_REACT.has(name)) {
        report(node, `React ${name} is not allowed; derive everything from the frame`);
      }
    }
    if (ts.isElementAccessExpression(node)) {
      const arg = node.argumentExpression;
      if (ts.isStringLiteralLike(arg) && (FORBIDDEN_PROPERTIES.has(arg.text) || FORBIDDEN_GLOBALS.has(arg.text))) report(arg, `Access to ["${arg.text}"] is not allowed`);
      if (!ts.isStringLiteralLike(arg) && !ts.isNumericLiteral(arg) && !isPlainIndex(arg)) {
        report(arg, "Computed property access must use a number, a loop variable or a string literal");
      }
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (EXTERNAL.test(node.text) && !isModuleSpecifier(node)) report(node, "External resource references are not allowed; draw everything in the module");
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) checkElement(node);
    ts.forEachChild(node, visit);
  };

  const checkIdentifier = (node: ts.Identifier) => {
    const parent = node.parent;
    // Property names, object keys and JSX attribute names are not references.
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return;
    if ((ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isPropertySignature(parent)) && parent.name === node) return;
    if (ts.isJsxAttribute(parent)) return;
    if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return;
    if (ts.isQualifiedName(parent) && parent.right === node) return;
    if (ts.isTypeReferenceNode(parent)) return;
    const text = node.text;
    if (FORBIDDEN_GLOBALS.has(text) && !isLocal(node)) report(node, `${text} is not available in authored sequences`);
    // `const { random } = Math` and similar destructuring reach the same members.
    if (ts.isBindingElement(parent) && ts.isObjectBindingPattern(parent.parent) && (parent.propertyName ?? parent.name) === node && FORBIDDEN_PROPERTIES.has(text)) {
      report(node, `Destructuring ${text} is not allowed`);
    }
  };

  const checkElement = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => {
    const tag = node.tagName.getText(file);
    if (FORBIDDEN_ELEMENTS.has(tag)) report(node, `<${tag}> is not allowed in authored sequences`);
    for (const property of node.attributes.properties) {
      if (ts.isJsxSpreadAttribute(property)) {
        if (/^[a-z]/.test(tag)) report(property, `Spread attributes on <${tag}> are not allowed; name each attribute`);
        continue;
      }
      const name = property.name.getText(file);
      if (name === "dangerouslySetInnerHTML" || name === "ref") report(property, `${name} is not allowed`);
      if (/^on[A-Z]/.test(name)) report(property, `Event handler ${name} is not allowed`);
      if (URL_ATTRIBUTES.has(name)) {
        const value = property.initializer;
        const literal = value && ts.isStringLiteral(value) ? value.text
          : value && ts.isJsxExpression(value) && value.expression && ts.isStringLiteralLike(value.expression) ? value.expression.text
          : undefined;
        if (literal === undefined || !/^#[A-Za-z][\w-]*$/.test(literal)) report(property, `${name} must be a literal "#id" reference to an element in this module`);
      }
    }
  };

  visit(file);
  return issues.length ? { ok: false, issues } : { ok: true };
}

function isModuleSpecifier(node: ts.Node): boolean {
  return ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent);
}

/** Identifiers, arithmetic on them and property reads such as `points[i + 1]` or `radii[(i + 1) % n]`. */
function isPlainIndex(node: ts.Expression): boolean {
  if (ts.isIdentifier(node) || ts.isNumericLiteral(node)) return true;
  if (ts.isParenthesizedExpression(node)) return isPlainIndex(node.expression);
  if (ts.isPrefixUnaryExpression(node)) return isPlainIndex(node.operand);
  if (ts.isBinaryExpression(node)) {
    const arithmetic = [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken];
    return arithmetic.includes(node.operatorToken.kind) && isPlainIndex(node.left) && isPlainIndex(node.right);
  }
  if (ts.isPropertyAccessExpression(node)) return ts.isIdentifier(node.expression) && !FORBIDDEN_PROPERTIES.has(node.name.text);
  if (ts.isCallExpression(node)) {
    // Math.floor(x) style index helpers.
    return ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "Math" && node.arguments.every((arg) => isPlainIndex(arg));
  }
  return false;
}
