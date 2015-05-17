var lwip = require('lwip');
var url = require('url');
var http = require('http');
var getImage = function(imageUrl, callback) {
    var bufs = [];
    var req = http.request(url.parse(imageUrl), function(res) {
        console.log(res.headers);
        res.on('data', function(d) {
            bufs.push(d);
        });

        res.on('end', function() {
            var buf = Buffer.concat(bufs);
            lwip.open(buf, 'jpg', function(err, image) {
                if(err) return callback(err);
                image.contain(75, 75, "white", "lanczos", function(err, image) {
                    if(err) return callback(err);
                    image.toBuffer("jpg", {}, function(err, jpg) {
                        if(err) return callback(err);
                        callback(null, jpg.toString('base64'));
                    });
                });
            })
        });
    });
    req.end();
};

getImage("http://lh5.ggpht.com/muqc7g6VtSCfQ7HdbX-ODU1j-7WdLE4d_Vom_KXM68LbLbo9kfXVncEkQlYA7e1Cd38sm1CPDw", function(err, data) {
    if(err) console.error(err);
    console.log("<img src=\"data:image/jpg;base64," + data + "\" />");
});
