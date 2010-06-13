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
// This writer does not write http headers.  
// It only emits a properly encoded multipart stream suitable to being streamed to 
// a http body or any other place multipart data is needed 
function writer () { return new Writer() }

function Writer () {
	this.firstPartReceived = false;
	this.state = S.STARTED;
	this.depth = 0;
	this.parts = [];
}

// Starts a part or nested part.
// Emits data events to listeners with headers for part.
//
// Errors if part is added to a part of type other than multipart,
// or if new part is started before the old one is written correctly.
//
// Params: A part headers object
// These should be of the form: 
// {name:"test", type:"multipart/mixed", filename="foo.txt"}
// Type is required and is encoded as "Content-Disposition"
// Name is required and is encoded as the name of the part.
// If set, filename is set as the filename of the part.
// Optionally pass in a headers object of other headers
// e.g Content-Length, which will be appended to the headers.
Writer.prototype.partBegin = function (part, headers) {
  var writer = this
    , type = part["type"]
    , partString = ""
    , boundary = part["boundary"]
    , name = part["name"]
    , filename = part["filename"]
    , currentPart = writer.parts[writer.parts.length-1];
    ;

  //sys.debug("writer depth:" + writer.depth);
  //sys.debug('writing part: ' + sys.inspect(part));

  if (!writer.boundary) error(writer, "Missing property boundary on writer");
    
  if (!type && !filename) {
    error(writer, "Missing required type property on part.");
  }
  
  if (!type && filename) {
    type = "inline";
  } else {
    type = "multipart/" + type;
  }  
  
  if (writer.state === S.WRITING) 
    return error(writer, "Illegal state. Cannot begin new part right now.");
  
  if (writer.state === S.PART_STARTED && currentPart.type !== "mixed")
      return error(writer, "Bad format. Cannot add part to non multipart parent.");
 
  partString += "--" + writer.boundary + CRLF;
  
  //write the Content-Disposition
  partString += "Content-Type: " + type;
  if (name) partString += "; name:'" + name + "'";
  if (filename) partString += "; filename='" + filename + "'";
  if (boundary) partString += "; boundary=" + boundary;
  partString += CRLF;
  // go down a nested part
  if (type === "mixed") writer.depth++;
  
  //write out any optional other headers
  if (headers) {
    Object.keys(headers).forEach(function (key) {
      partString += key + ": " + headers[key] + CRLF;
    });
  }
  emit(writer, "onData",  partString + CRLF);
  writer.state = S.PART_STARTED;
  writer.parts.push(part);
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
  var writer = this
  , currentPart = writer.parts[writer.parts.length-1]
  ;
  
	if (currentPart && currentPart.type !== "mixed" && writer.state !== S.WRITING) 
	  error(writer, "Illegal state.  Must write at least one chunk to this part before calling partEnd");
	
	emit(writer, "onData", CRLF + "--" + writer.boundary + "--" + CRLF);
	writer.state = S.PART_ENDED;
	currentPart = writer.parts.pop();
	if (currentPart && currentPart.type === "mixed") writer.depth--;
}


Writer.prototype.close = function () {
  var writer = this;
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


