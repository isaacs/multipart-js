var assert = require("assert"),
  multipart = require("../lib/multipart"),
  sys = require("sys");

writer = multipart.writer();

sys.debug("Create a multipart writer.");
sys.debug("");
assert.notEqual(writer, null, "should be able to obtain writer");

function output(msg) {
	sys.debug("  writer " + msg + ".");
}

// Some simple parts we will use
var goodSimpleParts = [
{ headers: { "content-disposition": "multipart-form"
, "content-type": "text/plain"
, "filename": "foo.txt"
}, body: "", encoded: "xx"}];

var badSimpleParts = [	{
headers: { "missing-content-disposition": "multipart-form"
, "content-type": "text/plain"
, "filename": "foo.txt"
}, body: "--boundary\r\n  fail: blahrg\r\n\r\n"}];


errorHandlerCalled = false;
errorMessage = "";
lastChunk = "";

function handleError (err) {
	assert.notEqual(err.message, undefined, "should pass Error object to onerror handler");
	errorMessage = err.message;
	output("emitted error: " + errorMessage);
	errorHandlerCalled = true;
}

function handleData (chunk) {
	lastChunk = chunk
	output("emitted data");
}

function checkForError(writer) {
  if (!writer.error) {
    sys.debug("Good, no errors on writer.");
  } else {
    assert.ok(false,  writer.error.message);
  }
}

writer.onerror = handleError;
writer.ondata = handleData;

sys.debug("Write the first part.  A simple good part.")
sys.debug("")

sys.debug("Wrong - write the part without setting boundary or type...");
writer.partBegin(goodSimpleParts[0].headers);
assert.ok(errorHandlerCalled, "Should error if type or boundary properties are not set.");

sys.debug("Set the type property.");
writer.type  = "multipart/form-data";
try {
	writer.partBegin(goodSimpleParts[0].headers);
	assert.ok(false, "Should throw error if not cleaned up from last call.");
}
catch (error) {
	output("threw: " + error.message);
}
sys.debug("Whoops, forgot to cleanup. Set the error to null. Try again...");
writer.error = null;
writer.partBegin(goodSimpleParts[0].headers);
assert.notEqual(writer.error, null, "Should error if boundary or type properties are not set");
writer.error = null;
sys.debug("Set boundary.  Try again...")
writer.boundary  = "boundary";
writer.partBegin(goodSimpleParts[0].headers);
checkForError(writer);
sys.debug("")
sys.debug("Were the http headers plus first part emitted and encoded properly?")
assert.equal(goodSimpleParts[0].encoded, lastChunk, "Should emit and encode first part properly.")

