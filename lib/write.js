// This API should be a symmetrical mirror of the writer API in writer.js
// Instead of having onpartbegin and onpartend events, call the partBegin
// and partEnd methods, and write file contents.  Then, the writer emits
// "data" events with chunks of data suitable for sending over the wire.
// That is, it converts the data objects into one big string.

// var w = writer();
// w.boundary = "foo-bar-bazfj3980haf38h";
// w.contentType = "form-data";
// w.headers = {...};
// w.partBegin({...}); // send the headers, causes the initial "data" event to emit
// w.write("..."); // encode the data, wrap it, etc., and emit more "data" events
// w.partEnd(); // close off that part, emitting a "data" event with the --boundary
// w.partBegin({...}); // another part...
// w.partBegin({...}); // if the last one was multipart, then do a child, else error.
// w.partEnd(); // close off that child part
// w.partEnd(); // close off the parent
// w.close(); // close off all open parts, and emit "end" event

var sys = require("sys")
  , utils = require("./utils")
  , error = utils.error
  , emit = utils.emit
  , multipartExpression = new RegExp(
    "^multipart\/(" +
    "mixed|rfc822|message|digest|alternative|" +
    "related|report|signed|encrypted|form-data|" +
    "x-mixed-replace|byteranges)", "i")
  , EVENTS = exports.EVENTS = ["onData", "onEnd", "onError"]
  , CR = "\r"
  , LF = "\n"
  , CRLF = CR+LF
  ;

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

function Writer () {
	this.firstPartReceived = false;
	this.state = S.STARTED;
}

// Starts a part or nested part.
// Emits data events to listeners with headers for part.
// If first part, will emit http headers plus headers of first part.
//
// Errors if part is added to a part of type other than multipart,
// or if new part is started before the old one is written correctly.
//
// Params: part headers.
// e.g. { "Content-type" : "text/plain; filename="foo.txt""}
// it is the caller's responsiblity to make sure these are set properly
Writer.prototype.partBegin = function (partHeaders) {
  writer = this;

  if (!writer.depth && writer.state !== S.STARTED && writer.state !== S.PART_ENDED) 
    return error(writer, "Illegal state. Cannot begin new part right now.");
  
  if (writer.depth && !isMulti(partHeaders))
    return error(writer, "Bad format. Cannot add part to non multipart parent.");
 
  //if (isMulti(partHeaders)) writer.depth++;
  
  if (writer.state === S.STARTED) writeHttpHeaders(writer);

  partString = "--" + writer.boundary + CRLF;
  Object.keys(partHeaders).forEach(function (key) {
    partString += key + ": " + partHeaders[key] + CRLF;
  });
  emit(writer, "onData",  partString + CRLF);
  writer.state = S.PART_STARTED;
}

// Writes a chunk to the multipart stream 
// Sets error if not called after a partBegin
Writer.prototype.write = function (chunk) {
  var writer = this;

	if (chunk === null) return;

	if (writer.state !== S.PART_STARTED) 
		error(writer, "Illegal state.  Must call partBegin before writing.");
		
  // TODO - encode the data if base64 content-transfer-encoding
	emit(writer, "onData", chunk);
	writer.state = S.WRITING;
}

// Writes the part end
// E.g. /r/n--boundary--
Writer.prototype.partEnd = function () {
  var writer = this;
	if (writer.state !== S.WRITING) 
	  error(writer, "Illegal state.  Must write at least one chunk to this part before calling partEnd");
	
	emit(writer, "onData", CRLF + "--" + writer.boundary + "--" + CRLF);
	writer.state = S.PART_ENDED;
	writer.depth--;
}


Writer.prototype.close = function () {
  if (!writer.depth && writer.state === S.PART_ENDED) return emit(writer, "onEnd");
  error(writer, "Illegal state.  Multiparts not written completely before close.")
};



// Write the headers plus 2 CRLFs, e.g.:
// Content-Type: multipart/form-data; boundary=---------------------------7d44e178b0434
// Host: api.flickr.com
// Content-Length: 35261
//
//
function writeHttpHeaders(writer) {
  if (!writer.contentType) 
    error(writer, "Missing contentType property. Must set this property on writer.");
   
  if (!multipartExpression.test(writer.contentType)) 
    error(writer, "Invalid property 'contentType'. Must be one of multipart(|" + 
     "mixed|rfc822|message|digest|alternative|" +
     "related|report|signed|encrypted|form-data|" +
     "x-mixed-replace|byteranges)");
  
  if (!writer.boundary) 
    error(writer, "Missing data. Must set boundary property on writer.");
    
  writer.headers = writer.headers || {}
  var headerString = "";
  writer.headers["Content-Type"] = writer.contentType + "; boundary=" + writer.boundary;
  Object.keys(writer.headers).forEach(function (key) {
    headerString += key + ": " + writer.headers[key];
  });
  emit(writer, "onData", headerString + CRLF + CRLF);
}

function newPart (writer) {
  var p = 
    { headers:{}
    , parent : writer.part
    };
  parent.parts = parent.parts || [];
  parent.parts.push(p);
}


