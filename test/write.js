var multipart = require("../lib/multipart")
  , assert = require("assert")
  , sys = require("sys")
  , fixture = require("./fixture")
  , testPart = function (expect, part) {
      sys.debug("test part: "+sys.inspect(expect));
      if (!expect) {
        throw new Error("Got more parts than expected: "+
          sys.inspect(part.headers));
      }
      for (var i in expect) {
        assert.equal(expect[i], part[i]);
      }
    }
  , messages = fixture.messages
  , writer = multipart.writer()
  , parser = multipart.parser()
  , expect
  , e
  ;


var messages = []
messages.push({
  headers: {
    "Content-Type": "multipart/form-data; boundary=AaB03x",
  },
  boundary : "AaB03x",  
  parts: [ {
    part: { 
      "type": "form-data", "name": "test"
    }
    , body: "hello"
    , encoded: [
        "--AaB03x"
        , "content-disposition: form-data; name=\"test\""
        , ""
        , "hello"
      ].join(",")
  }
  , { 
    part: { 
      "type": "form-data", "name": "test1"
    }
    , body: "hello1"
    , encoded: [
        "--AaB03x"
        , "content-disposition: form-data; name=\"test1\""
        , ""
        , "hello1"
      ].join(",")
  }
  ]
});

sys.debug("Create a multipart writer.");
sys.debug("");
assert.notEqual(writer, null, "should be able to obtain writer");

function output(msg) {
	sys.debug("  writer " + msg + ".");
}

errorHandlerCalled = false;
errorMessage = "";
lastChunk = "";

writer.onError = function  (err) {
	assert.notEqual(err.message, undefined, "should pass Error object to onError handler");
	errorMessage = err.message;
	output("emitted error: " + errorMessage);
	errorHandlerCalled = true;
}

writer.onData = function  (chunk) {
	lastChunk = chunk
	output("emitted data: " + lastChunk);
	parser.write(chunk);
}

writer.onEnd = function () {
  output("ended");
}

parser.onError = function (error) {
  assert.ok("false", "parser encounted error: " + error.message)
}

parser.onPartBegin = function (part) {
  sys.debug("parser started part successfully " + sys.inspect(part.headers));
}

parser.onPartEnd = function (part) {
  sys.debug("parser ended part succesfully: " + sys.inspect(part));
}

parser.onEnd = function () {
  sys.debug("parser ended");
}

parser.headers = messages[0].headers;

sys.debug("Write a part without setting boundary...");
try {
  writer.partBegin(messages[0].parts[0].part);
  assert.ok(errorHandlerCalled, "should emit onError if part written without boundary");
}catch (error) {
  sys.puts(error.message);
  assert.ok(errorHandlerCalled, "should emit onError if part written without boundary");
}

sys.debug("Set the boundary property and try again...");
writer.boundary  = messages[0].boundary;
writer.partBegin(messages[0].parts[0].part);

sys.debug("Write the body...")
writer.write(messages[0].parts[0].body);

sys.debug("Start another part without finishing...");
try {
  writer.partBegin(messages[0].parts[1].part);
} catch (error1) {
  assert.ok(errorHandlerCalled, "should emit onError if part written without finishing the part before");
}
sys.debug("Whoops, end the last part..")
writer.partEnd();

sys.debug("Start another simple part");
writer.partBegin(messages[0].parts[1].part);
sys.debug("Write body and end")
writer.write(messages[0].parts[1].body);
writer.partEnd();
writer.close();