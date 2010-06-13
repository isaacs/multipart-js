var multipart = require("../lib/multipart")
  , assert = require("assert")
  , sys = require("sys")
  , fixture = require("./fixture")
  , messages = fixture.messages
  , aSimpleMessage = fixture.aSimpleMessage
  , aNestedMessage = messages[0]
  , writer = multipart.writer()
  , parser = multipart.parser()
  , expect
  , e
  ;


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
  sys.debug("parser ended part succesfully");
}

parser.onEnd = function () {
  sys.debug("parser ended");
}

parser.headers = aSimpleMessage.headers;

sys.debug("Write a part without setting boundary...");
try {
  writer.partBegin(aSimpleMessage.parts[0].part);
  assert.ok(errorHandlerCalled, "should emit onError if part written without boundary");
}catch (error) {
  sys.puts(error.message);
  assert.ok(errorHandlerCalled, "should emit onError if part written without boundary");
}

sys.debug("Set the boundary property and try again...");
writer.boundary  = aSimpleMessage.boundary;
writer.partBegin(aSimpleMessage.parts[0].part);

sys.debug("Write the body...")
writer.write(aSimpleMessage.parts[0].body);

sys.debug("Start another part without finishing...");
try {
  writer.partBegin(aSimpleMessage.parts[1].part);
} catch (error1) {
  assert.ok(errorHandlerCalled, "should emit onError if part written without finishing the part before");
}
sys.debug("Whoops, end the last part..")
writer.partEnd();

sys.debug("Start another simple part");
writer.partBegin(aSimpleMessage.parts[1].part);
sys.debug("Write body and finish.")
writer.write(aSimpleMessage.parts[1].body);
writer.partEnd();
writer.close();
parser.close();

sys.debug("Ok, looks good. Now write a more complicated nested multipart");

writer =  multipart.writer();
parser = multipart.parser();

function testPart(expect, part) {
     sys.debug("test part: "+sys.inspect(part));
     if (!expect) {
       throw new Error("Got more parts than expected: "+
         sys.inspect(part.headers));
     }
     for (var i in expect) {
       //assert.equal(expect[i], part[i]);
     }
}

parser.onPartBegin = function (part) {
  testPart(expect[e++], part);
}

writer.onData = function (chunk) {
  parser.write(chunk);
}
 //a nested test from the fixtures

var expect = aNestedMessage.expect
 , e = 0; 
parser.headers = aNestedMessage.headers;
writer.boundary = aNestedMessage.boundary;
writer.partBegin(aNestedMessage.expect[0]); //start inner 1 mixed
writer.partBegin(aNestedMessage.expect[1]); //start inner 2 mixed
writer.partBegin(aNestedMessage.expect[2]); //inner 2, part 1
writer.write("hello, world");
writer.partEnd(); 
writer.partBegin(aNestedMessage.expect[3]); //inner 2, part 2
writer.write("hello to the world");
writer.partEnd();
writer.partEnd(); //finish inner2 
writer.partEnd(); //finish inner1
writer.partBegin(aNestedMessage.expect[4]); //start inner 3 mixed
writer.partBegin(aNestedMessage.expect[5]);
writer.write("hello, free the world"); // inner 3, part1
writer.partEnd(); 
writer.partBegin(aNestedMessage.expect[6]); // inner 3, part 2
writer.write("hello, for the world")
writer.partEnd();
writer.partEnd(); //end inner 3
writer.partBegin(aNestedMessage.expect[7]); // outer, part1
writer.write("hello, outer world");
writer.partEnd(); 
writer.partEnd(); //finish outer
writer.close();
parser.close();

