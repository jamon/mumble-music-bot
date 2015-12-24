command = c:(start / stop / volume / queue / search) { return c; }
start = "start" { return { command: "start" }; }
stop = "stop" { return { command: "stop" }; }
skip = "skip" / "next" { return { command: "skip" }; }
queue = ( "queue" / "play" ) _ val:($[0-9]+) { return { command: "queue", value: parseInt(val, 10) }; }
volume = "volume" _ val:($[0-9]+) { return { command: "volume", value: parseInt(val, 10) }; }
search = "search" _ type:("album" / "track" / "artist" / "station")? _ term:$.* {
    return { command: "search", type: type, term: term};
}

_ "whitespace" = [ \t\n\r]*
