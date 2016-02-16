var fs = require('fs');
var PNG = require('pngjs').PNG;
var quantize = require('quantize');

function Compressor(config) {
  this.file = config.file || undefined;
  this.recurse = config.recurse || false;
  this.force = config.force || false;
}

Compressor.prototype.quantize = function(file) {
  var inp = fs.createReadStream(file);
  var dec = new PNG({ filterType: 4 });
  
  function onParsed () {
    var d = this.data;
    var w = this.width, h = this.height;
    var q = [];
    var m, mp = 0;
    
    function all(fn) {
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          fn((w * y + x) << 2);
        }
      }
    }
    
    all(function (idx) {
      q.push([
        d[idx    ],
        d[idx + 1],
        d[idx + 2]
      ]);
    });
    
    // compressed color palette
    m = quantize(q, 256);
    
    all(function (idx) {
      var px = m.map(q[mp++]); 
      
      d[idx    ] = px[0];
      d[idx + 1] = px[1];
      d[idx + 2] = px[2];
    });
    
    this.pack().pipe(
      fs.createWriteStream(file)
    );
  }

  inp
  .pipe(dec)
  .on('parsed', onParsed);
};

Compressor.prototype.compress = function(f) {
  var file = f || this.file;
  var stats = fs.statSync(file);

  if (stats.size <= 0) {
    return;
  }
  
  this.quantize(file);
};

Compressor.prototype.isdir = function(file) {
  var stat = fs.statSync(file);

  return stat && stat.isDirectory();
};

Compressor.prototype.isimg = function(file) {
  var f = file.toLowerCase();/*
  return f.indexOf('.jpg')  !== -1 ||
    f.indexOf('.png')  !== -1      ||
    f.indexOf('.jpeg') !== -1;*/
  return f.indexOf('.png') !== -1;
};

Compressor.prototype.opendir = function(d) {
  var recurse = this.recurse;
  var force = this.force;
  var dir = d || this.file;
  var files = fs.readdirSync(dir);
  var dotfile = dir + '/.compressed';
  var list;
  
  try {
    list = fs.readFileSync(dotfile);
    list = JSON.parse(list);
  } catch (e) {
    list = {};
  }
  
  for (var i = 0, l = files.length; i < l; i++ ) {
    var file = dir + '/' + files[i];

    if (this.isdir(file) && recurse) {
      this.opendir.call(this, file);
    } else if (this.isimg(file)) {
      if (!list[file] || force)
        this.compress(file);
      list[file] = true;
    }
  }
  
  fs.writeFileSync(dotfile, JSON.stringify(list));
};

Compressor.prototype.run = function() {
  if (this.isdir(this.file)) {
    this.opendir();
  } else if (this.isimg(this.file)) {
    this.compress();
  }
};

if (process.argv.length >= 3) {
  var args = process.argv;
  
  args.splice(0, 2);
  
  var compressor = new Compressor({
    file: __dirname + '/' + args[0],
    recurse: args.indexOf('-r') !== -1,
    force: args.indexOf('-f') !== -1
  });
  
  compressor.run();
}
