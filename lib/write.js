
exports.writer = writer;
exports.Writer = Writer;

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

// TODO: Implement all of this, and remove the Not Yet Implemented stuff.
function NYI () { throw new Error("Not yet implemented") }

function Writer () { NYI() }
Writer.prototype.write = NYI;
Writer.prototype.close = NYI;
Writer.prototype.partBegin = NYI;
Writer.prototype.partEnd = NYI;
