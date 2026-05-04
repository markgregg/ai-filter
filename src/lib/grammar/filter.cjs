// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const moo = require("moo");
const lexer = moo.compile({
  WS:      { match: /[ \t\r\n]+/, lineBreaks: true },
  GTE_SYM:  ">=",
  LTE_SYM:  "<=",
  NEQ_SYM:  "!=",
  BANGSTAR: "!*",
  LTSTAR:   "<*",
  GTSTAR:   ">*",
  GT_SYM:   ">",
  LT_SYM:   "<",
  EQ_SYM:   "=",
  STAR:     "*",
  BANG:     "!",
  COMMA:    ",",
  LPAREN:   "(",
  RPAREN:   ")",
  ISODATE:  /\d{4}-\d{2}-\d{2}/,
  NUMBER:   /\d+(?:\.\d+)?/,
  WORD: {
    match: /[A-Za-z_][A-Za-z0-9_]*/,
    type: moo.keywords({
      AND:      "and",
      OR:       "or",
      FROM:     "from",
      TO:       "to",
      BETWEEN:  "between",
      IN_KW:    "in",
      NOT_KW:   "not",
      ONEOF:    "__oneof__",
      NOTONEOF: "__notoneof__",
    }),
  },
});
const OP_WORDS = {
  __gte__:">=", __lte__:"<=", __gt__:">", __lt__:"<",
  __neq__:"!", __startswith__:"<*", __endswith__:">*",
  __notcontains__:"!*", __contains__:"*",
  __oneof__:"in", __notoneof__:"!",
  is:"=", are:"=", was:"=", were:"=", equals:"=", matches:"=", exactly:"=",
  not:"!", excluding:"!", except:"!",
  contains:"*", includes:"*", has:"*", like:"*",
  excludes:"!*", prefix:"<*", suffix:">*",
  over:">", above:">", after:">", exceeds:">",
  under:"<", below:"<", before:"<",
  min:">=", minimum:">=", max:"<=", maximum:"<=",
  among:"in", within:"in",
};
function opFromWord(w) { return OP_WORDS[w.toLowerCase()] ?? null; }
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "main", "symbols": ["_", "query", "_"], "postprocess": d => d[1]},
    {"name": "_", "symbols": []},
    {"name": "_", "symbols": [(lexer.has("WS") ? {type: "WS"} : WS)], "postprocess": () => null},
    {"name": "query", "symbols": ["clause"], "postprocess": d => [d[0]]},
    {"name": "query", "symbols": ["query", "_", (lexer.has("AND") ? {type: "AND"} : AND), "_", "clause"], "postprocess": d => [...d[0], {type:"AND"}, d[4]]},
    {"name": "query", "symbols": ["query", "_", (lexer.has("OR") ? {type: "OR"} : OR), "_", "clause"], "postprocess": d => [...d[0], {type:"OR"}, d[4]]},
    {"name": "clause", "symbols": [(lexer.has("LPAREN") ? {type: "LPAREN"} : LPAREN), "_", "query", "_", (lexer.has("RPAREN") ? {type: "RPAREN"} : RPAREN)], "postprocess": d => ({type:"group", clauses: d[2]})},
    {"name": "clause", "symbols": ["rangeExpr"], "postprocess": id},
    {"name": "clause", "symbols": ["listExpr"], "postprocess": id},
    {"name": "clause", "symbols": ["valueExpr"], "postprocess": id},
    {"name": "rangeExpr", "symbols": ["fieldToken", "_", (lexer.has("FROM") ? {type: "FROM"} : FROM), "_", "value", "_", (lexer.has("TO") ? {type: "TO"} : TO), "_", "value"], "postprocess": d => ({type:"range", field:d[0], from:d[4], to:d[8]})},
    {"name": "rangeExpr", "symbols": ["fieldToken", "_", (lexer.has("BETWEEN") ? {type: "BETWEEN"} : BETWEEN), "_", "value", "_", (lexer.has("AND") ? {type: "AND"} : AND), "_", "value"], "postprocess": d => ({type:"range", field:d[0], from:d[4], to:d[8]})},
    {"name": "rangeExpr", "symbols": [(lexer.has("FROM") ? {type: "FROM"} : FROM), "_", "value", "_", (lexer.has("TO") ? {type: "TO"} : TO), "_", "value"], "postprocess": d => ({type:"range", field:null, from:d[2], to:d[6]})},
    {"name": "rangeExpr", "symbols": [(lexer.has("BETWEEN") ? {type: "BETWEEN"} : BETWEEN), "_", "value", "_", (lexer.has("AND") ? {type: "AND"} : AND), "_", "value"], "postprocess": d => ({type:"range", field:null, from:d[2], to:d[6]})},
    {"name": "listExpr", "symbols": ["fieldToken", "_", "positiveListOp", "_", "valueList"], "postprocess": d => ({type:"list", field:d[0], op:"in", values:d[4]})},
    {"name": "listExpr", "symbols": ["fieldToken", "_", "negativeListOp", "_", "valueList"], "postprocess": d => ({type:"list", field:d[0], op:"!", values:d[4]})},
    {"name": "positiveListOp", "symbols": [(lexer.has("IN_KW") ? {type: "IN_KW"} : IN_KW)], "postprocess": () => "in"},
    {"name": "positiveListOp", "symbols": [(lexer.has("ONEOF") ? {type: "ONEOF"} : ONEOF)], "postprocess": () => "in"},
    {"name": "negativeListOp", "symbols": [(lexer.has("NOTONEOF") ? {type: "NOTONEOF"} : NOTONEOF)], "postprocess": () => "!"},
    {"name": "valueList", "symbols": ["value"], "postprocess": d => [d[0]]},
    {"name": "valueList", "symbols": ["valueList", "_", (lexer.has("COMMA") ? {type: "COMMA"} : COMMA), "_", "value"], "postprocess": d => [...d[0], d[4]]},
    {"name": "valueExpr", "symbols": ["fieldToken", "_", "operator", "_", "value"], "postprocess": d => ({type:"value", field:d[0], op:d[2], value:d[4]})},
    {"name": "valueExpr", "symbols": ["fieldToken", "_", "value"], "postprocess": d => ({type:"value", field:d[0], op:null, value:d[2]})},
    {"name": "valueExpr", "symbols": ["value"], "postprocess": d => ({type:"value", field:null, op:null, value:d[0]})},
    {"name": "operator", "symbols": [(lexer.has("GTE_SYM") ? {type: "GTE_SYM"} : GTE_SYM)], "postprocess": () => ">="},
    {"name": "operator", "symbols": [(lexer.has("LTE_SYM") ? {type: "LTE_SYM"} : LTE_SYM)], "postprocess": () => "<="},
    {"name": "operator", "symbols": [(lexer.has("NEQ_SYM") ? {type: "NEQ_SYM"} : NEQ_SYM)], "postprocess": () => "!"},
    {"name": "operator", "symbols": [(lexer.has("BANGSTAR") ? {type: "BANGSTAR"} : BANGSTAR)], "postprocess": () => "!*"},
    {"name": "operator", "symbols": [(lexer.has("LTSTAR") ? {type: "LTSTAR"} : LTSTAR)], "postprocess": () => "<*"},
    {"name": "operator", "symbols": [(lexer.has("GTSTAR") ? {type: "GTSTAR"} : GTSTAR)], "postprocess": () => ">*"},
    {"name": "operator", "symbols": [(lexer.has("GT_SYM") ? {type: "GT_SYM"} : GT_SYM)], "postprocess": () => ">"},
    {"name": "operator", "symbols": [(lexer.has("LT_SYM") ? {type: "LT_SYM"} : LT_SYM)], "postprocess": () => "<"},
    {"name": "operator", "symbols": [(lexer.has("EQ_SYM") ? {type: "EQ_SYM"} : EQ_SYM)], "postprocess": () => "="},
    {"name": "operator", "symbols": [(lexer.has("STAR") ? {type: "STAR"} : STAR)], "postprocess": () => "*"},
    {"name": "operator", "symbols": [(lexer.has("BANG") ? {type: "BANG"} : BANG)], "postprocess": () => "!"},
    {"name": "operator", "symbols": [(lexer.has("NOT_KW") ? {type: "NOT_KW"} : NOT_KW)], "postprocess": () => "!"},
    {"name": "operator", "symbols": [(lexer.has("WORD") ? {type: "WORD"} : WORD)], "postprocess": d => opFromWord(d[0].value)},
    {"name": "fieldToken", "symbols": [(lexer.has("WORD") ? {type: "WORD"} : WORD)], "postprocess": d => d[0].value},
    {"name": "value", "symbols": [(lexer.has("WORD") ? {type: "WORD"} : WORD)], "postprocess": d => ({kind:"word",   raw: d[0].value})},
    {"name": "value", "symbols": [(lexer.has("NUMBER") ? {type: "NUMBER"} : NUMBER)], "postprocess": d => ({kind:"number", raw: d[0].value})},
    {"name": "value", "symbols": [(lexer.has("ISODATE") ? {type: "ISODATE"} : ISODATE)], "postprocess": d => ({kind:"date",   raw: d[0].value})},
    {"name": "value", "symbols": [(lexer.has("IN_KW") ? {type: "IN_KW"} : IN_KW)], "postprocess": () => ({kind:"word",  raw: "in"})},
    {"name": "value", "symbols": [(lexer.has("OR") ? {type: "OR"} : OR)], "postprocess": () => ({kind:"word",  raw: "or"})},
    {"name": "value", "symbols": [(lexer.has("AND") ? {type: "AND"} : AND)], "postprocess": () => ({kind:"word",  raw: "and"})},
    {"name": "value", "symbols": [(lexer.has("NOT_KW") ? {type: "NOT_KW"} : NOT_KW)], "postprocess": () => ({kind:"word",  raw: "not"})},
    {"name": "value", "symbols": [(lexer.has("FROM") ? {type: "FROM"} : FROM)], "postprocess": () => ({kind:"word",  raw: "from"})},
    {"name": "value", "symbols": [(lexer.has("TO") ? {type: "TO"} : TO)], "postprocess": () => ({kind:"word",  raw: "to"})}
]
  , ParserStart: "main"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
