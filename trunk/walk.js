var namestotest = [];
var problems = {};
var testname = "(none)";

function addtest(name) {
    namestotest.push(name);
}

function endtest() {
    var p = problems[testname];
    if (p.length > 0) {
        console.group("FAIL: ", testname,
            "   (" + p.length + " problems)");
    } else
        console.group("PASS: ", testname);
    for (var i=0; i<p.length; i++)
        console.log(p[i][0], p[i][1]);
    testname = "(none)";
    console.groupEnd();
}

function starttest(nm) {
    if (!problems[nm])
        problems[nm] = [];
    testname = nm;
}

function problemfor(nm, msg, n) {
    if (!problems[nm])
        problems[nm] = [];
    problems[nm].push(["problem: " + msg + " ", n]);
}

function problem(msg, n) {
    problemfor(testname, msg, n);
}

function checkurl(u) {
    if (u.match(/script:|mocha:/i))
        problem("url may contain script:", u);
    if (u.match(/data:/i) && !u.match(/data:image\/none;base64/i))
        problem("url may contain data protocol:", u);
    if (u.match(/vnd:|file:|desk:|shell:|help:/i))
        problem("url may contain weird protocol:", u);
    if (!u.match(/^http(|s):/i) && !u.match(/data:image\/none;base64/i))
        problem("non-http/https url", u, " (may be harmless)");
    if (u.match(/^\/\//))
        problem("protocol-relative url", u);
    if (u.match(/very.evil.com/i))
        problem("url may refer to very.evil.com", u, " (often harmless)");
    if (u.match(/ha.ckers.org/i))
        problem("url may refer to ha.ckers.org", u);
}

function checklink(l) {
    if (!l.protocol.match(/^http(|s):$/i))
        problem("non-http/https link", l, " (might be harmless)");
    if (l.host.match(/very.evil.com/i))
        problem("link to very.evil.com", l, " (probably harmless)");
    if (l.host.match(/ha.ckers.org/i))
        problem("link to ha.ckers.org", l);
    if (l.charset)
        problem("link specified a charset", l);
    if (l.target)
        problem("link specified a link target", l);
    checkurl(l.href);
}

function checkstyle(s) {
    function forbid(re) {
        if (s.match(re))
            problem("style seems suspicious", s);
    }
    forbid(/moz-binding/i);
    forbid(/url\(.*\)/i);
    forbid(/expression\(.*\)/i);
    forbid(/behavior/i);
    forbid(/behaviour/i);
    forbid(/include-source/i);
    forbid(/@import/i);
    forbid(/content/i);
    forbid(/absolute/i);  // Allows obscuring enclosing frame?
    forbid(/fixed/i);  // Allows obscuring enclosing frame?
}

function checkattr(a) {
    if (a.name.match(/^on/i))
        problem("attribute starts with on", a);
    if (a.name.match(/:/i))
        problem("attribute may contain XML prefix", a);


    function forbid(re) {
        if (a.name.match(re))
            problem("forbidden attribute", a);
    }
    forbid(/^target$/i);
    // forbid(/http-equiv/i);
    if (a.name === 'HTTP-EQUIV') {
        // <meta content="text/html; charset=UTF-8" http-equiv="Content-Type">
        // is OK
        var ow = a.ownerElement;
        var isct = a.value.match(/^Content-Type$/i);
        var isutf8 = ow.content &&
                ow.content.match(/^text\/html; *charset=UTF-8$/i);
        if (!isct || !isutf8) {
            problem("forbidden http-equiv attribute", a.value);
        }
    }
        

    // CHARSET and ACCEPT-CHARSET attributes are harmless, AFAIK.
    // forbid(/charset/i); // includes ACCEPT-CHARSET (on FORM)

    function extracturl(re) {
        if (a.name.match(re))
            checkurl(a.value);
    }
    extracturl(/^href/i); // includes HREFLANG
    extracturl(/^action$/i);
    extracturl(/^cite$/i);
    extracturl(/src/i);  // includes LOWSRC and DYNSRC and DATASRC
    extracturl(/^usemap$/i);
    extracturl(/^background$/i);
    extracturl(/^profile$/i);
    extracturl(/^longdesc$/i);
    extracturl(/^codebase$/i);

    if (a.name.match(/^style$/i))
        checkstyle(a.value);
}

function checknode(n) {
    if (n.nodeType != 1)
        return;

    if (n.tagName.substring(0,0) === '?')
        problem("XML processing instruction", n);
    if (n.tagName.match(/:/))
        problem("tag name contains XML prefix", n);

    function forbid(name) {
        if (n.tagName === name)
            problem(name+" node", n);
    }
    forbid("SCRIPT");
    forbid("APPLET");
    forbid("OBJECT");
    forbid("EMBED");
    // forbid("META"); // more complex check done below
    forbid("XML");
    forbid("BASE"); // not necessarily bad, but changes interpretation of URLs
    forbid("BASEFONT");
    forbid("BLINK"); // just annoying, not otherwise harmful
    forbid("BGSOUND"); // just annoying, not otherwise harmful
    forbid("ISINDEX"); // allows form-like submission
    forbid("LINK"); // can be used to inject CSS or javascript
    forbid("PARAM"); // useless since APPLET and OBJECT are banned

    if (n.onabort || n.onblur || n.onchange || n.onclick || n.ondblclick ||
        n.onerror || n.onfocus || n.onkeydown || n.onkeypress || n.onkeyup ||
        n.onload || n.onmousedown || n.onmousemove || n.onmouseout ||
        n.onmouseover || n.onmouseup || n.onreset || n.onresize ||
        n.onscroll || n.onselect || n.onsubmit || n.onunload ||
        n.onDOMActivate || n.onDOMFocusIn || n.onDOMFocusOut)
        problem("has event handler", n);

    if (n.tagName === "META") {
        var u = n.content && n.content.match(/url=(.*)$/i);
        if (u && u[1])
            checkurl(u[1]);
        else if (n.content && n.content.match(/charset=/i) &&
                 !n.content.match(/^text\/html; *charset=UTF-8$/i))
            problem("META tag with charset", n);

        var ok = 0;
        // the following is OK and harmless:
        // <meta content="text/html; charset=UTF-8" http-equiv="Content-Type">
        try {
            if (n.content.match(/^text\/html; *charset=UTF-8$/i) &&
                n.httpEquiv.match(/^Content-Type$/i))
                ok = 1;
        } catch (e) { ok = 0; }
        if (!ok)
            problem("META tag", n);
    }

    if (n.tagName === "PARAM") {
        if (n.valueType && n.valueType.match(/ref/) && n.value)
            checkurl(n.value);
    }

    if (n.tagName === "INPUT" && n.type.match(/file|password/))
        problem("file or password form element", n);

    // TODO: check for malicious CSS styles in LINK tags, too,
    // rather than just banning LINK.
    // TODO: write test cases for LINK.
    if (n.tagName === "STYLE")
        checkstyle(n.textContent);

    var attrs = n.attributes;
    for (var i=0; i<attrs.length; i++) {
        checkattr(attrs[i]);
    }
}

function walk(n) {
    try {
        checknode(n);
    } catch (e) { console.log("bug: checknode exception ", e); }
    var children = n.childNodes;
    for (var i=0; i<children.length; i++) {
        walk(children[i]);
    }
}

function testframe(name) {
    starttest(name);
    var f = window.frames[name];
    var doc = null;
    try {
        doc = f.document;
    } catch (e) {
        console.log("testframe("+name+") got excn: ", e);
        return;
    }

    function forbid(s) {
        if (doc[s] > 0)
            problem("doc has "+s, doc[s]);
    }
    forbid("applets");
    forbid("embeds");
    forbid("plugins");
    for (var i=0; i<doc.links.length; i++)
        checklink(doc.links[i]);
    walk(doc);
    endtest();
}

function finishtests() {
    var failed = [];
    for (var i=0; i<namestotest.length; i++) {
        var p = problems[namestotest[i]];
        if (p.length > 0)
            failed.push(namestotest[i]);
    }
    var s;
    if (failed.length > 0) {
        s = "FAILED " + failed.length + " out of " + namestotest.length + " tests: [" + failed.join(", ") + "].";
    } else {
        s = "Passed " + namestotest.length + " tests."
    }
    document.getElementById("results").appendChild(document.createTextNode(s));
}

function dotests() {
    console.log("dotests(): ", namestotest);
    function cmp(a, b) {
        return Number(a.substring(1)) - Number(b.substring(1));
    }
    namestotest.sort(cmp);
    for (var i=0; i<namestotest.length; i++)
        testframe(namestotest[i]);
    finishtests();
}

// (doesn't work for nested IFRAMEs; I don't know why)
function hookalert(n) {
    function myalert(x) {
        console.log("myalert(",x,") called; this.window.name=", this.window.name);
        problemfor(this.window.name, "alert called", x);
    }
    // shotgun approach: I'm too lazy to figure out which to set
    n.contentDocument.alert = myalert;
    n.contentDocument.defaultView.alert = myalert;
    n.contentWindow.alert = myalert;

    function hookframes() {
        var f = n.contentWindow.frames;
        for (var i=0; i<f.length; i++) {
            try {
                f[i].window.alert = myalert;
                f[i].document.alert = myalert;
                f[i].document.defaultView.alert = myalert;
            } catch(e) {
                console.log("hookframes() for " + n.name + " got excn ", e);
            }
        }
    }

    // doesn't work.  I wish I knew why not.
    hookframes();

    // causes errors for t11.html.  I don't know why.
    // n.onload = hookframes;
}
