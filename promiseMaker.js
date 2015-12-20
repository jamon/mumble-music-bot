//  Promise maker - un-fucks node.js's callback bullshit
//  does something like this, but automatically:
/*
new Promise((resolve, reject) => {
    fs.readFile("./config.json", "utf8", (err, result) => {
        if(err) reject(err); else resolve(result);
    });
}).then(console.log);
*/
module.exports = func => {
    return new Promise((resolve, reject) => {
        func((err, ...rest) => {
            if(err) reject(err); else resolve.apply(undefined, rest);
        });
    });
};

// usage example:
//p(cb => fs.readFile("./config.json", "utf8", cb)).then(console.log);

