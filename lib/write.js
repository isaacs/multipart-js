// This API should be a symmetrical mirror of the parser API in parser.js
// Instead of having onpartbegin and onpartend events, call the partBegin
// and partEnd methods, and write file contents.  Then, the writer emits
// "data" events with chunks of data suitable for sending over the wire.
// That is, it converts the data objects into one big string.

// var w = writer();
// w.boundary = "foo-bar-bazfj3980haf38h";
// w.type = "form-data";
// w.headers = {...};
// w.partBegin({...}); // send the headers, causes the initial "data" event to emit
// w.write("..."); // encode the data, wrap it, etc., and emit more "data" events
// w.partEnd(); // close off that part, emitting a "data" event with the --boundary
// w.partBegin({...}); // another part...
// w.partBegin({...}); // if the last one was multipart, then do a child, else error.
// w.partEnd(); // close off that child part
// w.partEnd(); // close off the parent
// w.close(); // close off all open parts, and emit "end" event

var sys = require("sys"),
  wrapExpression = /^[ \t]+/,
  multipartExpression = new RegExp(
    "^multipart\/(" +
    "mixed|rfc822|message|digest|alternative|" +
    "related|report|signed|encrypted|form-data|" +
    "x-mixed-replace|byteranges)", "i"),
  CR = "\r",
  LF = "\n",
  CRLF = CR+LF,

  EVENTS = exports.EVENTS = ["ondata", "onerror"];

var S = 0;
exports.STATE =
  { STARTED : S++  //nothing received
  , PART_STARTED : S++ // a part header was written
  , WRITING : S++  // client is writing a part
  , PART_ENDED : S++ // a end part was written
  , CLOSED : S++ // close was called
  };
for (S in exports.STATE) exports.STATE[exports.STATE[S]] = S;
S = exports.STATE;

exports.writer = writer;
exports.Writer = Writer;

function NYI () { throw new Error("Not yet implemented") }

// Returns a new writer.
// Attaches event handlers to it, and they'll get notified
// call myWriter.write(chunk) and then myWriter.close() when it's done.
function writer () { return new Writer() }

function error (writer, message) {
  writer.error = new Error(message);
  emit(writer, "onerror", writer.error);
  return false;
}

function emit (writer, ev, data) {
  if (writer[ev]) writer[ev](data);
}
function newPart (writer) {
  var p = 
    { headers:{}
    , parent : writer.part
    };
  parent.parts = parent.parts || [];
  parent.parts.push(p);
}
function writeHeaders(writer) {
  if (!writer.type) {
    error(writer, "Missing data. Must set type property on writer.")
    return false;
  } else if (!multipartExpression.test(writer.type)) {
    error(writer, "Invalid type property. Must be one of multipart(|" + 
     "mixed|rfc822|message|digest|alternative|" +
     "related|report|signed|encrypted|form-data|" +
     "x-mixed-replace|byteranges)");
    return false;    
  }
  if (!writer.boundary) {
    error(writer, "Missing data. Must set boundary property on writer.")
    return false;    
  }
  headers = writer.headers || {}
  headers["Content-Type"] = writer.type;
}

function Writer () {
  this.state = S.STARTED;
  this.firstPartReceived = false;
  this.partChunk = "";
}

// Writes a chunk to the multipart stream 
// Sets error if not called after a partBegin
Writer.prototype.write = write; 
function write (chunk) {
  var writer = this;
  //ye old state machine
  if (writer.error) throw writer.error;
  if (chunk === null) return;
  if (writer.state !== S.PART_STARTED) {
    error(writer, "Illegal state.  Must call partBegin before writing.");
  }
  // TODO - encode the data if base64 content-transfer-encoding
  emit(writer, "ondata", chunk);
}

Writer.prototype.close = NYI;

// Starts a part or nested part.
// Emits data events to listeners with headers for part.
// If first part, will emit http headers plus headers of first part.
// Sets error if part is added to a part of type other than multipart,
// or if new part is started before the old one is written correctly.
//
// Params: object describing header for event
// e.g. { "content-type" : "text/plain", filename : "foo.txt" }
Writer.prototype.partBegin = partBegin;
function partBegin (partDesc) {
  var writer = this;
  if (writer.error) throw writer.error;
  if (writer.state !== S.STARTED && writer.state !== S.PART_ENDED) {
    return error(writer, "Illegal state. Cannot begin new part right now.");
  }
  else if (this.currentPart && !isMulti(this.currentPart)) {
    return error(writer, "Bad format. Cannot add part to non multipart parent.");
  } else if (!this.currentPart){
    // this is the first part
    if (!writeHeaders(writer)) return;
  }
  // TODO encode part headers based on partDesc
  emit(writer, "ondata", "TODO: encoded chunk");
}

Writer.prototype.partEnd = NYI;

