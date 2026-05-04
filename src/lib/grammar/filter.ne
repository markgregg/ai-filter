# filter.ne � Nearley grammar for the easy-filter NLP resolver.
#
# Input MUST be pre-processed by synonyms.ts first:
#   multi-word phrases have been collapsed to single __token__ words.
#
# Compile with:
#   nearleyc src/lib/grammar/filter.ne -o src/lib/grammar/filter.js

@{%
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
%}

@lexer lexer

main -> _ query _  {% d => d[1] %}

_ -> null | %WS  {% () => null %}

query ->
    clause
      {% d => [d[0]] %}
  | query _ %AND _ clause
      {% d => [...d[0], {type:"AND"}, d[4]] %}
  | query _ %OR _ clause
      {% d => [...d[0], {type:"OR"}, d[4]] %}

clause ->
    %LPAREN _ query _ %RPAREN
      {% d => ({type:"group", clauses: d[2]}) %}
  | rangeExpr  {% id %}
  | listExpr   {% id %}
  | valueExpr  {% id %}

rangeExpr ->
    fieldToken _ %FROM _ value _ %TO _ value
      {% d => ({type:"range", field:d[0], from:d[4], to:d[8]}) %}
  | fieldToken _ %BETWEEN _ value _ %AND _ value
      {% d => ({type:"range", field:d[0], from:d[4], to:d[8]}) %}
  | %FROM _ value _ %TO _ value
      {% d => ({type:"range", field:null, from:d[2], to:d[6]}) %}
  | %BETWEEN _ value _ %AND _ value
      {% d => ({type:"range", field:null, from:d[2], to:d[6]}) %}

listExpr ->
    fieldToken _ positiveListOp _ valueList
      {% d => ({type:"list", field:d[0], op:"in", values:d[4]}) %}
  | fieldToken _ negativeListOp _ valueList
      {% d => ({type:"list", field:d[0], op:"!", values:d[4]}) %}

positiveListOp ->
    %IN_KW   {% () => "in" %}
  | %ONEOF   {% () => "in" %}

negativeListOp ->
    %NOTONEOF  {% () => "!" %}

valueList ->
    value                          {% d => [d[0]] %}
  | valueList _ %COMMA _ value    {% d => [...d[0], d[4]] %}

valueExpr ->
    fieldToken _ operator _ value  {% d => ({type:"value", field:d[0], op:d[2], value:d[4]}) %}
  | fieldToken _ value             {% d => ({type:"value", field:d[0], op:null, value:d[2]}) %}
  | value                          {% d => ({type:"value", field:null, op:null, value:d[0]}) %}

operator ->
    %GTE_SYM   {% () => ">=" %}
  | %LTE_SYM   {% () => "<=" %}
  | %NEQ_SYM   {% () => "!"  %}
  | %BANGSTAR  {% () => "!*" %}
  | %LTSTAR    {% () => "<*" %}
  | %GTSTAR    {% () => ">*" %}
  | %GT_SYM    {% () => ">"  %}
  | %LT_SYM    {% () => "<"  %}
  | %EQ_SYM    {% () => "="  %}
  | %STAR      {% () => "*"  %}
  | %BANG      {% () => "!"  %}
  | %NOT_KW    {% () => "!"  %}
  | %WORD      {% d => opFromWord(d[0].value) %}

fieldToken ->
    %WORD  {% d => d[0].value %}

value ->
    %WORD    {% d => ({kind:"word",   raw: d[0].value}) %}
  | %NUMBER  {% d => ({kind:"number", raw: d[0].value}) %}
  | %ISODATE {% d => ({kind:"date",   raw: d[0].value}) %}
  | %IN_KW   {% () => ({kind:"word",  raw: "in"})      %}
  | %OR      {% () => ({kind:"word",  raw: "or"})      %}
  | %AND     {% () => ({kind:"word",  raw: "and"})     %}
  | %NOT_KW  {% () => ({kind:"word",  raw: "not"})     %}
  | %FROM    {% () => ({kind:"word",  raw: "from"})    %}
  | %TO      {% () => ({kind:"word",  raw: "to"})      %}
