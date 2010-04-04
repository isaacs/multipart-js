
var sys = require("sys"),
  wrapExpression = /^[ \t]+/,
  multipartExpression = new RegExp(
    "^multipart\/(" +
    "mixed|rfc822|message|digest|alternative|" +
    "related|report|signed|encrypted|form-data|" +
    "x-mixed-replace|byteranges)", "i"),
  boundary = "boundary=",
  CR = "\r",
  LF = "\n",
  CRLF = CR+LF,
  MAX_BUFFER_LENGTH = 64 * 1024,

  EVENTS = exports.EVENTS = ["partbegin", "partend", "data", "end"];

var S = 0;
exports.STATE =
  { NEW_PART : S++
  , HEADER_START : S++
  , HEADER_FIELD : S++
  , HEADER_VALUE : S++
  , HEADER_CD_VALUE : S++
  , HEADER_CT_VALUE : S++
  , HEADER_BOUNDARY : S++
  , HEADER_FILENAME : S++
  , HEADER_MP_TYPE : S++
  , BOUNDARY : S++
  , BODY : S++
  };
for (S in exports.STATE) exports.STATE[exports.STATE[S]] = S;
S = exports.STATE;
  

exports.parser = parser;
exports.Parser = Parser;

// returns a new parser
// attach event handlers to it, and they'll get notified
// call myParser.write(chunk) and then myParser.close() when it's done.
function parser () { return new Parser() }

function error (parser, message) {
  parser.error = new Error(message);
  emit(parser, "onerror", parser.error);
}
function end (parser) {
  // close the whole stack of open parts, and emit "end"
  throw new Error("TODO");
}
function emit (parser, ev, data) {
  if (parser[ev]) parser[ev](data);
}
function newPart (parser) {
  var p = 
    { headers:{}
    , parent : parser.part
    };
  parent.parts = parent.parts || [];
  parent.parts.push(p);
}

function Parser () {
  this.buffer = "";
  parser.part = parser;
  this.state = S.NEW_PART;
  // handy for debugging bad input
  this.position = this.column = this.line = 0;
}
Parser.prototype.write = write;
function write (chunk) {
  var parser = this;
  // ye olde state machine
  if (chunk === null) return end(parser);
  var i = 0, c = "";
  while (parser.c = c = chunk.charAt(i++)) {
    parser.position ++;
    if (c === "\n") {
      parser.line ++;
      parser.column = 0;
    } else parser.column ++;
    if (parser.error) throw parser.error;
    switch (parser.state) {
      case S.NEW_PART:
        // either just starting out at first, or just saw a boundary.
        // start a part, swallow whitespace, and start looking for a header.
        newPart(parser);
        if (is(whitespace, c)) continue;
        parser.headerField = c;
        parser.state = S.HEADER_FIELD;
      continue;
      case S.HEADER_FIELD:
        // if c is :, then deal with it.
        if (c !== ":") {
          parser.headerField += c;
          continue;
        }
        // done with the field name, read the value
        parser.state = S.HEADER_VALUE;
        parser.headerValue = "";
      continue;
      case S.HEADER_VALUE:
        // read the value, then pull out filename and/or boundary if it's C[DT]
        // in any event, set the parser.part.headers[parser.headerField] to the value.
        if (c === "\r") {
          parser.state = S.HEADER_VALUE_CR;
          continue;
        }
        parser.headerValue += c;
      continue;
      case S.HEADER_VALUE_CR:
        if (c === "\n") {
          parser.state = S.HEADER_VALUE_CRLF;
          continue;
        }
        error(parser, "Badly formatted message, LF not found after CR.");
      continue;
      case S.HEADER_VALUE_CRLF:
        if (c === " " || c === "\t") {
          parser.state = S.HEADER_VALUE_WRAP;
          continue;
        }
        // done with the header field.  deal with it.
        var fieldName = parser.headerField.trim().toLowerCase();
        parser.part.headers[ fieldName ] = parser.headerValue.trim();
        if (fieldName === "content-type" || fieldName === "content-disposition") {
          
        }
        // now start parsing the next header, or move on to the body.
        if (c === "\r") {
          parser.state = S.HEADER_ENDING;
        } else {
          parser.state = S.HEADER_FIELD;
          parser.headerField = c;
        }
      continue;
      case S.HEADER_ENDING:
        if (c !== "\n") {
          error(parser, "Bad formatted message, LF not found after CR");
          continue;
        }
        parser.state = S.BODY;
        emit(parser, "onstartbegin", parser.part);
      continue;
      default:
        error(parser, "Unhandled state: "+parser.state+" "+S[parser.state]);
      continue;
    }
  }
}



