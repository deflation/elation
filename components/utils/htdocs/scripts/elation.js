var elation = new function() {
  this.extend = function(name, func) {
		var ptr = this,
				parts = name.split("."),
				i;
		
		for (i = 0; i < parts.length-1; i++) {
			if (typeof ptr[parts[i]] == 'undefined')
				ptr[parts[i]] = {};
			
			ptr = ptr[parts[i]];
		}
		
		if (typeof ptr[parts[i]] == 'undefined') {
			ptr[parts[i]] = func;
		} else {
			console.log("elation: tried to clobber existing component '" + name + "'");
		}
  }
}

if (typeof jQuery != 'undefined') {
  $TF = $ = jQuery.noConflict();
}

elation.extend("checkhash", new function() {
  this.timer = setInterval(function() { 
    try { 
      if (typeof elation.search.backbutton == 'object') {
        elation.search.backbutton.check();
      }
    } catch(e) { }
  }, 500);
  
  this.fetch = function(url, callback) {
    elation.ajax.Queue({
      url: url, 
      callback: [ 
        this, 
        callback
      ]
    });
  }
});

elation.extend("component", new function() {
  this.namespace = "elation";
  this.registry = [];
  this.init = function() {
    var componentattr = "component";
    var argsattr = this.namespace+':args';
    // Find all elements which have a namespace:componentattr attribute

    //var elements = $("["+this.namespace+"\\:"+componentattr+"]"); 
		/*
    function nsresolver(prefix) {  
      var ns = {  
        'xhtml' : 'http://www.w3.org/1999/xhtml',  
        'elation': 'http://www.ajaxelation.com/xmlns'  
      };  
			alert(ns[prefix]);
      return ns[prefix] || null;  
    }  
		*/
		
    var nsresolver = document.createNSResolver(document.documentElement);
		
		// FIXME - I've started work to switch this over to use xpath selectors instead of jquery but namespaces make it a pain
		//         Right now this is just selecting all elements, very inefficient...
		//var selector = '//*['+this.namespace+':'+componentattr+']';
		//var selector = "//*[@*["+this.namespace+":"+componentattr+"]]";
		//var selector = "//*[@*[namespace-uri()='http://www.ajaxelation.com/xmlns']]";
		//var selector = "//*[local-name()='component']";
		var selector = "//*";
		
    var result = document.evaluate(selector, document, nsresolver, XPathResult.ANY_TYPE, null);
    var elements = [];
    while (element = result.iterateNext()) {
      elements.push(element);
    }
		console.log('i init now');
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      var componenttype = element.getAttribute(this.namespace+':'+componentattr);
      var componentname = element.getAttribute(this.namespace+':name') || element.id;
      if (componenttype) {
        var componentargs = {}, j;
        // First look for a JSON-encoded args array in the element's direct children
        for (j = 0; j < element.children.length; j++) {
          if (element.children[j].nodeName == argsattr.toUpperCase()) {
            try {
              componentargs = JSON.parse(element.children[j].innerHTML);
              break; // only one args array per block, bail out when we find one so we don't waste time with the rest
            } catch(e) {
              // Probably JSON syntax error
              console.log("Could not parse " + argsattr + ": " + element.children[j].innerHTML);
            }
          }
        }
        // Then, loop through the attributes and parse out any individual arguments which can be specified as attributes
        for (j = 0; j < element.attributes.length; j++) {
          if (element.attributes[j].nodeName.substring(0, argsattr.length+1) == argsattr+'.') {
            componentargs[element.attributes[j].nodeName.substring(argsattr.length+1)] = element.attributes[j].nodeValue;
          }
        }
        // Instantiate the new component with all parsed arguments
        //elation.component.create(componenttype, element, componentargs);
        var componentclass = elation.utils.arrayget(elation, componenttype);
        if (typeof componentclass == 'function') {
          componentclass(componentname, element, componentargs);
        } 
      }
    }
  }
  this.add = function(name, classdef) {
    // At the top level, a component is just a function which checks to see if
    // an instance with the given name exists already.  If it doesn't we create
    // it, and then we return a reference to the specified instance.
    var el = function(name, container, args) {
      if (!name && name !== 0) // If no name was passed, use the current object count as a name instead ("anonymous" components)
        name = el.objcount;
      if (!el.obj[name]) {
        el.obj[name] = new el.fn.init(name, container, args);
        el.objcount++;
      }
      return el.obj[name];
    };
    el.objcount = 0;
    el.obj = {}; // this is where we store all the instances of this type of component
    el.fn = (typeof classdef == 'function' ? new classdef : classdef); // and this is where we store the functions
    // If no init function is defined, add a default one
    if (!el.fn.init) el.fn.init = function(name, container, args) { 
      this.name = name;
      this.container = container;
      this.args = args;
    }
    el.fn.init.prototype = el.fn; // The functions which were passed in are attached to the insantiable component objects
    elation.extend(name, el); // inject the newly-created component wrapper into the main elation object
  }
});

elation.extend('onloads',new function() {
  this.done = false;
  this.onloads = [];

  this.add = function(expr) {
    this.onloads.push(expr);
  }
  this.init = function() {
    /* for Safari */
    if (/WebKit/i.test(navigator.userAgent)) { // sniff
      this.timer = setInterval(function() {
        if (/loaded|complete/.test(document.readyState)) {
          elation.onloads.execute(); // call the onload handler
        }
      }, 10);
      return;
    }

    /* for Mozilla/Opera9 */
    if (document.addEventListener) {
      document.addEventListener("DOMContentLoaded", elation.onloads.execute, false);
      return;
    }
    /* for Internet Explorer */
    /*@cc_on @*/
    /*@if (@_win32)
     document.write("<scr"+"ipt id=\"__ie_onload\" defer src=\"/blank.fhtml\"><\/scr"+"ipt>");
      var script = document.getElementById("__ie_onload");
      script.onreadystatechange = function() {
        if (this.readyState == "complete") {
          elation.onloads.execute(); // call the onload handler
        }
      };
      return;
    /*@end @*/
    
    window.onload = elation.onloads.execute;
  }
  this.execute = function() {
    // quit if this function has already been called
    if (elation.onloads.done) return;

    // flag this function so we don't do the same thing twice
    elation.onloads.done = true;

    // kill the timer
    if (elation.onloads.timer) clearInterval(elation.onloads.timer);

    var script = '';
    var expr;
    while (expr = elation.onloads.onloads.shift()) {
      if (typeof expr == 'function') {
        expr(); // FIXME - this causes all function references to be executed before all strings
      } else {
        script += expr + (expr.charAt(expr.length - 1) != ';' ? ';' : '');
      }
    }

    eval(script);
  }
});
elation.onloads.init();

elation.extend("html.dimensions", function(element, ignore_size) {
	if (typeof element != 'object' || element === window) {
		var	width = window.innerWidth		|| document.documentElement.clientWidth		|| document.body.clientWidth,
				height = window.innerHeight	|| document.documentElement.clientHeight	|| document.body.clientHeight;
		
		return {
			0 : width,
			1 : height,
			x : 0,
			y : 0,
			w : width,
			h : height,
			s : elation.html.getscroll()
		};
	}
	
	var width = ignore_size ? 0 : element.offsetWidth,
			height = ignore_size ? 0 : element.offsetHeight,
			left = element.offsetLeft,
			top = element.offsetTop,
      id = element.id || '';
	
	while (element = element.offsetParent) {
		top += element.offsetTop - element.scrollTop;
		left += element.offsetLeft - element.scrollLeft;
	}
	
	if (elation.browser.type == 'safari')
		top += elation.html.getscroll(1);
	
  return {
		0 : left,
		1 : top,
		x : left, 
		y : top, 
		w : width, 
		h : height 
	};
});

elation.extend("html.size", function(obj) {
  return [obj.offsetWidth, obj.offsetHeight];
});

elation.extend("html.position", function(obj) {
  var curleft = curtop = 0;
  if (obj.offsetParent) {
    curleft = obj.offsetLeft;
    curtop = obj.offsetTop;
    while (obj = obj.offsetParent) {
      curleft += obj.offsetLeft;
      curtop += obj.offsetTop;
    }
  }
  return [curleft,curtop];
});

// methods for css classname information and manipulation
elation.extend("html.hasclass", function(element, className) {
  var re = new RegExp("(^| )" + className + "( |$)", "g");
  return element.className.match(re);
});

elation.extend("html.addclass", function(element, className) {
  if (!elation.html.hasclass(element, className)) {
    element.className += " " + className;
  }
});

elation.extend("html.removeclass", function(element, className) {
  var re = new RegExp("(^| )" + className + "( |$)", "g");
  if (element.className.match(re)) {
    element.className = element.className.replace(re, " ");
  }
});

elation.extend("html.toggleclass", function(element, className) {
  if (this.hasclass(element, className))
    this.removeclass(element, className)
  else
    this.addclass(element, className);
});

// for great justice
elation.extend("html.hasClass", elation.html.hasClass);
elation.extend("html.addClass", elation.html.addClass);
elation.extend("html.removeClass", elation.html.removeClass);
elation.extend("html.toggleClass", elation.html.toggleClass);

/* creates a new html element
      example: elation.html.create({ 
        tag:'div', 
        classname:'example',
        style: { width:'30px', height:'20px' },
        attributes: { innerHTML: 'Test!' },
        append: elementObj
      });
*/
elation.extend('html.create', function(parms, classname, style, additional, append, before) {
  if (typeof parms == 'object')
    var tag = parms.tag,
        classname = parms.classname,
        style = parms.style,
        additional = parms.attributes,
        append = parms.append,
        before = parms.before;
  
  var element = document.createElement(tag || parms);
  
  if (classname)
    element.className = classname;
  
  if (style)
    for (var property in style)
      element.style[property] = style[property];
  
  if (additional)
    for (var property in additional)
      element[property] = additional[property];
  
	if (append)
		if (before)
      append.insertBefore(element, before);
    else
      append.appendChild(element);
	
  return element;
});

elation.extend('html.getscroll', function(shpadoinkle) {
  if (elation.iphone && elation.iphone.scrollcontent)
    var pos = [0,0];//elation.iphone.scrollcontent.getPosition();
	else if (typeof pageYOffset != 'undefined') 
		var pos = [ 
			pageXOffset, 
			pageYOffset 
		];
	else 
		var	QuirksObj = document.body,
				DoctypeObj = document.documentElement,		
				element = (DoctypeObj.clientHeight) 
					? DoctypeObj 
					: QuirksObj,
				pos = [ 
					element.scrollLeft, 
					element.scrollTop 
				];

	switch (shpadoinkle) {
		case 0:
			return pos[0];
		
		case 1:
			return pos[1];
		
		default:
			return [ 
				pos[0], 
				pos[1] 
			];
	}
});
elation.extend("html.get_scroll", elation.html.getscroll);
elation.extend("html.getScroll", elation.html.getscroll);

elation.extend("utils.encodeURLParams", function(obj) {
  var value,ret = '';
  
  if (typeof obj == "string") {
    ret = obj;
  } else {
    for (var key in obj) {
      ret += (ret != '' ? '&' : '') + key + '=' + encodeURIComponent(obj[key]); 
    }
  }
  
  return ret;
});

/* Sets value in a multilevel object element 
* args:
* obj -- multilevel object
* element -- 'quoted' object element (as string)
*/
elation.extend("utils.arrayset", function(obj, element, value) {
  var ptr = obj;
  var x = element.split(".");
  for (var i = 0; i < x.length - 1; i++) {
    if (ptr==null || (typeof ptr[x[i]] != 'array' && typeof ptr[x[i]] != 'object' && i != x.length-1)) {
      ptr[x[i]] = {};
    }
    ptr = ptr[x[i]];
  }
  if (typeof ptr == "object") {
    ptr[x[x.length-1]] = value;
  }
});
elation.extend("utils.arrayget", function(obj, name) {
  var ptr = obj;
  var x = name.split(".");
  for (var i = 0; i < x.length; i++) {
    if (ptr==null || (typeof ptr[x[i]] != 'array' && typeof ptr[x[i]] != 'object' && i != x.length-1)) {
      ptr = null;
      break;
    }
    ptr = ptr[x[i]];
  }
  return (typeof ptr == "undefined" ? null : ptr);
});

//Returns true if it is a DOM node
elation.extend("utils.isnode", function(obj) {
  return (
    typeof Node === "object" ? obj instanceof Node : 
    typeof obj === "object" && typeof obj.nodeType === "number" && typeof obj.nodeName==="string"
  );
});

//Returns true if it is a DOM element    
elation.extend("utils.iselement", function(obj) {
  return (
    typeof HTMLElement === "object" ? obj instanceof HTMLElement : //DOM2
    typeof obj === "object" && obj.nodeType === 1 && typeof obj.nodeName==="string"
  );
});
elation.extend("utils.isTrue", function(obj) {
  if (obj == true || obj == 'true') 
    return true;
  
  return false;
});
	
elation.extend("utils.isNull", function(obj) {
  if (obj == null || typeof obj == 'undefined') 
    return true;
  
  return false;
});
	
elation.extend("utils.isEmpty", function(obj) {
  if (obj !== null && 
      obj !== "" && 
      obj !== 0 && 
      typeof obj !== "undefined" && 
      obj !== false) 
    return false;
  
  return true;
});
// runs through direct children of obj and 
// returns the first matching <tag> [className]
elation.extend("utils.getFirstChild", function(obj, tag, className) {
  for (var i=0; i<obj.childNodes.length; i++)
    if (obj.childNodes[i].nodeName == tag.toUpperCase())
      if (className && this.hasclass(obj, className))
        return obj.childNodes[i];
      else if (!className)
        return obj.childNodes[i];
  
  return null;
});

// runs through direct children of obj and 
// returns the last matching <tag> [className]
elation.extend("utils.getLastChild", function(obj, tag, className) {
  for (var i=obj.childNodes.length-1; i>=0; i--)
    if (obj.childNodes[i].nodeName == tag.toUpperCase())
      if (className && this.hasclass(obj, className))
        return obj.childNodes[i];
      else if (!className)
        return obj.childNodes[i];
  
  return null;
});

// runs through all children recursively and returns 
// all elements matching <tag> [className]
elation.extend("utils.getAll", function(obj, tag, className) {
  var	ret = [],
      all = obj.getElementsByTagName(tag);
  
  for (var i=0; i<all.length; i++)
    if (className && this.hasclass(all[i], className))
      ret.push(all[i]);
    else if (!className)
      ret.push(all[i]);
  
  return ret;
});

// runs through the direct children of obj and returns 
// all elements matching <tag> [className]
elation.extend("utils.getOnly", function(obj, tag, className) {
  if (!obj || !tag)
    return;
  
  var ret = [];
  
  for (var i=0; el=obj.childNodes[i]; i++)
    if (el.nodeName == tag.toUpperCase()) {
      if (className && this.hasclass(el, className))
        ret.push(el);
      else if (!className)
        ret.push(el);
    }
  
  return ret;
});

// Navigates up the DOM from a given element looking for match
elation.extend("utils.getParent", function(element, tag, all_occurrences) {
  var ret = [];
  
  while (element && element.nodeName != 'BODY') {
    if (element.nodeName == tag.toUpperCase()) {
      if (all_occurrences)
        ret.push(element);
      else
        return element;
    }
    
    element = element.parentNode;
  }
  
  return (ret.length == 0 ? false : ret);
});

elation.extend("utils.indexOf", function(array, object) {
	if (typeof array == 'string')
		array = array.split("");
	
	for (var i=0; i<array.length; i++) {
		if (array[i] === object) {
			return i;
		}
	}
	
	return -1;
});

elation.extend("utils.fixPNG", function() {
  if (elation.browser.type == "msie" && elation.browser.version <= 6) {
    //FIXME this breaks fixpng, I'm commenting it out, if this breaks other things... well, if you happen to see this comment maybe it will inspire you to try uncommenting out the line below to see if that has an effect -- mac daddy
    document.execCommand("BackgroundImageCache",false,true);
    var imglist = document.getElementsByTagName("img");
    for (var i = 0; i < imglist.length; i++) {
      if(imglist[i].src.substr(imglist[i].src.length - 3, 3) == "png" && !imglist[i].style.filter) {
        var origsrc = imglist[i].src;
        imglist[i].src = '/images/utils/nothing.gif';
        imglist[i].style.filter = "progid:DXImageTransform.Microsoft.AlphaImageLoader(src='" + origsrc + "', sizingMethod='image')";
      }
    }
  }
});

elation.extend("utils.stringify", function(parms) {
  var value, ret = '';
  
  for (var key in parms) {
    value = parms[key];
    ret += key + '=' + value + '&'; 
  }
  
  return ret.substr(0,ret.length-1);
});

elation.extend("utils.htmlentities", function(string, quote_style) {
	// http://kevin.vanzonneveld.net
  var histogram = {}, symbol = '', tmp_str = '', entity = '';
	tmp_str = string.toString();
	
	if (false === (histogram = elation.utils.get_html_translation_table('HTML_ENTITIES', quote_style))) {
			return false;
	}
	
	for (symbol in histogram) {
			entity = histogram[symbol];
			tmp_str = tmp_str.split(symbol).join(entity);
	}
	
	return tmp_str;
});
elation.extend("utils.get_html_translation_table", function(table, quote_style) {
	// http://kevin.vanzonneveld.net
  var entities = {}, histogram = {}, decimal = 0, symbol = '';
	var constMappingTable = {}, constMappingQuoteStyle = {};
	var useTable = {}, useQuoteStyle = {};
	
	useTable      = (table ? table.toUpperCase() : 'HTML_SPECIALCHARS');
	useQuoteStyle = (quote_style ? quote_style.toUpperCase() : 'ENT_COMPAT');
	
	// Translate arguments
	constMappingTable[0]      = 'HTML_SPECIALCHARS';
	constMappingTable[1]      = 'HTML_ENTITIES';
	constMappingQuoteStyle[0] = 'ENT_NOQUOTES';
	constMappingQuoteStyle[2] = 'ENT_COMPAT';
	constMappingQuoteStyle[3] = 'ENT_QUOTES';
	
	// Map numbers to strings for compatibilty with PHP constants
	if (!isNaN(useTable)) {
			useTable = constMappingTable[useTable];
	}
	if (!isNaN(useQuoteStyle)) {
			useQuoteStyle = constMappingQuoteStyle[useQuoteStyle];
	}

	if (useTable == 'HTML_SPECIALCHARS') {
			// ascii decimals for better compatibility
			entities['38'] = '&amp;';
			if (useQuoteStyle != 'ENT_NOQUOTES') {
					entities['34'] = '&quot;';
			}
			if (useQuoteStyle == 'ENT_QUOTES') {
					entities['39'] = '&#039;';
			}
			entities['60'] = '&lt;';
			entities['62'] = '&gt;';
	} else if (useTable == 'HTML_ENTITIES') {
			// ascii decimals for better compatibility
		entities['38']  = '&amp;';
			if (useQuoteStyle != 'ENT_NOQUOTES') {
					entities['34'] = '&quot;';
			}
			if (useQuoteStyle == 'ENT_QUOTES') {
					entities['39'] = '&#039;';
			}
		entities['60']  = '&lt;';
		entities['62']  = '&gt;';
		entities['160'] = '&nbsp;';
		entities['161'] = '&iexcl;';
		entities['162'] = '&cent;';
		entities['163'] = '&pound;';
		entities['164'] = '&curren;';
		entities['165'] = '&yen;';
		entities['166'] = '&brvbar;';
		entities['167'] = '&sect;';
		entities['168'] = '&uml;';
		entities['169'] = '&copy;';
		entities['170'] = '&ordf;';
		entities['171'] = '&laquo;';
		entities['172'] = '&not;';
		entities['173'] = '&shy;';
		entities['174'] = '&reg;';
		entities['175'] = '&macr;';
		entities['176'] = '&deg;';
		entities['177'] = '&plusmn;';
		entities['178'] = '&sup2;';
		entities['179'] = '&sup3;';
		entities['180'] = '&acute;';
		entities['181'] = '&micro;';
		entities['182'] = '&para;';
		entities['183'] = '&middot;';
		entities['184'] = '&cedil;';
		entities['185'] = '&sup1;';
		entities['186'] = '&ordm;';
		entities['187'] = '&raquo;';
		entities['188'] = '&frac14;';
		entities['189'] = '&frac12;';
		entities['190'] = '&frac34;';
		entities['191'] = '&iquest;';
		entities['192'] = '&Agrave;';
		entities['193'] = '&Aacute;';
		entities['194'] = '&Acirc;';
		entities['195'] = '&Atilde;';
		entities['196'] = '&Auml;';
		entities['197'] = '&Aring;';
		entities['198'] = '&AElig;';
		entities['199'] = '&Ccedil;';
		entities['200'] = '&Egrave;';
		entities['201'] = '&Eacute;';
		entities['202'] = '&Ecirc;';
		entities['203'] = '&Euml;';
		entities['204'] = '&Igrave;';
		entities['205'] = '&Iacute;';
		entities['206'] = '&Icirc;';
		entities['207'] = '&Iuml;';
		entities['208'] = '&ETH;';
		entities['209'] = '&Ntilde;';
		entities['210'] = '&Ograve;';
		entities['211'] = '&Oacute;';
		entities['212'] = '&Ocirc;';
		entities['213'] = '&Otilde;';
		entities['214'] = '&Ouml;';
		entities['215'] = '&times;';
		entities['216'] = '&Oslash;';
		entities['217'] = '&Ugrave;';
		entities['218'] = '&Uacute;';
		entities['219'] = '&Ucirc;';
		entities['220'] = '&Uuml;';
		entities['221'] = '&Yacute;';
		entities['222'] = '&THORN;';
		entities['223'] = '&szlig;';
		entities['224'] = '&agrave;';
		entities['225'] = '&aacute;';
		entities['226'] = '&acirc;';
		entities['227'] = '&atilde;';
		entities['228'] = '&auml;';
		entities['229'] = '&aring;';
		entities['230'] = '&aelig;';
		entities['231'] = '&ccedil;';
		entities['232'] = '&egrave;';
		entities['233'] = '&eacute;';
		entities['234'] = '&ecirc;';
		entities['235'] = '&euml;';
		entities['236'] = '&igrave;';
		entities['237'] = '&iacute;';
		entities['238'] = '&icirc;';
		entities['239'] = '&iuml;';
		entities['240'] = '&eth;';
		entities['241'] = '&ntilde;';
		entities['242'] = '&ograve;';
		entities['243'] = '&oacute;';
		entities['244'] = '&ocirc;';
		entities['245'] = '&otilde;';
		entities['246'] = '&ouml;';
		entities['247'] = '&divide;';
		entities['248'] = '&oslash;';
		entities['249'] = '&ugrave;';
		entities['250'] = '&uacute;';
		entities['251'] = '&ucirc;';
		entities['252'] = '&uuml;';
		entities['253'] = '&yacute;';
		entities['254'] = '&thorn;';
		entities['255'] = '&yuml;';
	} else {
			throw Error("Table: "+useTable+' not supported');
			return false;
	}
	
	// ascii decimals to real symbols
	for (decimal in entities) {
			symbol = String.fromCharCode(decimal);
			histogram[symbol] = entities[decimal];
	}
	
	return histogram;
});

JSON=function(){function f(n){return n<10?'0'+n:n;}Date.prototype.toJSON=function(key){return this.getUTCFullYear()+'-'+f(this.getUTCMonth()+1)+'-'+f(this.getUTCDate())+'T'+f(this.getUTCHours())+':'+f(this.getUTCMinutes())+':'+f(this.getUTCSeconds())+'Z';};var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapeable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={'\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r','"':'\\"','\\':'\\\\'},rep;function quote(string){escapeable.lastIndex=0;return escapeable.test(string)?'"'+string.replace(escapeable,function(a){var c=meta[a];if(typeof c==='string'){return c;}return'\\u'+('0000'+(+(a.charCodeAt(0))).toString(16)).slice(-4);})+'"':'"'+string+'"';}function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==='object'&&typeof value.toJSON==='function'){value=value.toJSON(key);}if(typeof rep==='function'){value=rep.call(holder,key,value);}switch(typeof value){case'string':return quote(value);case'number':return isFinite(value)?String(value):'null';case'boolean':case'null':return String(value);case'object':if(!value){return'null';}gap+=indent;partial=[];if(typeof value.length==='number'&&!(value.propertyIsEnumerable('length'))){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||'null';}v=partial.length===0?'[]':gap?'[\n'+gap+partial.join(',\n'+gap)+'\n'+mind+']':'['+partial.join(',')+']';gap=mind;return v;}if(rep&&typeof rep==='object'){length=rep.length;for(i=0;i<length;i+=1){k=rep[i];if(typeof k==='string'){v=str(k,value,rep);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}else{for(k in value){if(Object.hasOwnProperty.call(value,k)){v=str(k,value,rep);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}v=partial.length===0?'{}':gap?'{\n'+gap+partial.join(',\n'+gap)+'\n'+mind+'}':'{'+partial.join(',')+'}';gap=mind;return v;}}return{stringify:function(value,replacer,space){var i;gap='';indent='';if(typeof space==='number'){for(i=0;i<space;i+=1){indent+=' ';}}else if(typeof space==='string'){indent=space;}rep=replacer;if(replacer&&typeof replacer!=='function'&&(typeof replacer!=='object'||typeof replacer.length!=='number')){throw new Error('JSON.stringify');}return str('',{'':value});},parse:function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==='object'){for(k in value){if(Object.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v;}else{delete value[k];}}}}return reviver.call(holder,key,value);}cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return'\\u'+('0000'+(+(a.charCodeAt(0))).toString(16)).slice(-4);});}if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,'@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,']').replace(/(?:^|:|,)(?:\s*\[)+/g,''))){j=eval('('+text+')');return typeof reviver==='function'?walk({'':j},''):j;}throw new SyntaxError('JSON.parse');}};}();

elation.extend('JSON', new function() {
  this.parse = function(text) {
    return this.JSON(['decode', 'parse'], text);
  }
  
  this.stringify = function(text) {
    return this.JSON(['encode', 'stringify'], text);
  }
  
  this.JSON = function(parms, text) {
		var key = (typeof JSON[parms[0]] == 'function' ? parms[0] : parms[1]);
    
		return (key == 'parse' ? JSON.parse(text) : JSON.stringify(text));
  }
});
elation.extend('cookie', {
	set: function(parms, value, expires, domain, secure, path, date) {
		name = parms.name || parms;
		expires = parms.expires || expires || '';
    domain = parms.domain || domain || '';
    secure = parms.secure || secure || '';
    path = parms.path || path || '/';
		date = parms.date || new Date();
		
		if (date instanceof Date)
			date = date.getDate() + "/" + (date.getMonth() + 1) + "/" + (date.getFullYear() + 1);
		
    var curCookie = name + "=" + escape(value) + "; expires=" + date + " 00:00:00" +
        ((path) ? "; path=" + path : "") +
        ((domain) ? "; domain=" + domain : "") +
        ((secure) ? "; secure" : "");
		
    document.cookie = curCookie;
    return curCookie;
	},
	
	get: function(name) {
    var theCookies = document.cookie.split(/[; ]+/);
    
		for (var i = 0 ; i < theCookies.length; i++) {
			var aName = theCookies[i].substring(0, elation.utils.indexOf(theCookies[i], '='));
			
			if (aName == name) 
				return theCookies[i];
    }
	}
});
elation.extend("find", function(selectors, parent, first) {
  /*
    selector engine can use commas, spaces, and find classnames via period.
    need to add id support and multiple classname on single tag support
    this code is used for browsers which dont have their own selector engines
    this could be made a lot better.
  */
  this.findCore = function(selectors, oparent) {
    var	selectors = selectors.split(','),
        elements = [],
        selector, section, tag, tags, classname, isParent, parent, parents;
    
    for (var s=0; s<selectors.length; s++) {
      parent = oparent || document.getElementsByTagName('BODY')[0];
      parents = [parent];
      section = selectors[s].split(' ');
      
      for (var p=0; parent = parents[p]; p++) {
        for (var q=0; q<section.length; q++) {
          isParent = (q = section.length - 1);
          selector = section[q].split('.');
          tag = selector[0] || '*';
          tags = parent.getElementsByTagName(tag);
          classname = selector.length > 1 ? selector[1] : false;
          
          for (var i=0; i<tags.length; i++) {
            if (classname) {
              if (elation.html.hasclass(tags[i], classname))
                if (isParent)
                  parents.push(tags[i]);
                else
                  elements.push(tags[i]);
            } else
              if (isParent)
                parents.push(tags[i]);
              else
                elements.push(tags[i]);
          }
        }
      }
    }
    
    return elements;
  }

  var result;
  
  if (elation.utils.isTrue(parent)) {
    first = true;
    parent = null;
  }
  
  if (document.querySelectorAll) 
    result = (parent) 
      ? parent.querySelectorAll(selectors) 
      : document.querySelectorAll(selectors);
  else
    result = this.findCore(selectors, parent);
  
  if (first && typeof result == 'object')
    if (result.length > 0)
      result = result[0];
    else
      result = null;
  
  return result;
});

// grabs a js or css file and adds to document
elation.extend('file.get', function(type, file, func) {
  if (!type || !file)
    return false;
  
  var	head = document.getElementsByTagName("HEAD")[0],
      element = document.createElement((type == 'javascript' ? "SCRIPT" : "LINK"));
  
  if (type == 'javascript') {
    element.type = "text/javascript";
    element.src = file;
  } else {
    element.type = "text/css";
    element.rel = "stylesheet";
    element.href = file;
  }
  
  if (func)
    element.onload = func;
  
  head.appendChild(element);
  
  return element;
});

// create file.batch object for grabbing multiple files
elation.extend('file.batch', function() {
	this.callbacks = [];
	this.files = [];
	
	this.add = function(url, type, component) {
		if (typeof url == 'string') {
      var dependency = elation.file.dependencies.add(url, this, type, component)
      
			if (dependency) 
        this.files.push(dependency);
    }
	}
	
	this.callback = function(script) {
		this.callbacks.push(script);
		
		if (this.files.length == 0)
			this.done(true);
	}
	
	this.done = function(url) {
		if (url)
			for (var i=0; i<this.files.length; i++) 
				if (!this.files[i].loaded && this.files[i].type != 'css') 
					return;
		
		for (var i=0; i<this.callbacks.length; i++) 
			switch (typeof this.callbacks[i]) {
				case "string":
					eval(this.callbacks[i]); 
					break;
				
				case "function":
					this.callbacks[i](); 
					break;
			}
		
		this.callbacks = [];
	}
});

// ajaxlib uses this to keep track of which css/js files are loaded and fetch ones that arent.
elation.extend('file.dependencies', new function() {
	this.host = '';
	this.files = {};
	this.registered = { 
		javascript: {}, 
		css: {} 
	};
	this.waiting = { 
		javascript: {}, 
		css: {} 
	};
	
	this.register = function(sFile, check, type) {
    var	type = type || 'javascript',
				registered = this.registered[type],
				waiting = this.waiting[type];
		
		if (registered[sFile])
			return;
		
    if (typeof check == 'undefined')
      check = true;
		
		registered[sFile] = true;
		
		if (waiting[sFile]) {
			var	url = waiting[sFile],
					file = this.files[url],
					components = this.getComponents(url);
			
			delete waiting[sFile];
      
      this.checkWaiting(file, components, type);
		}
	}
  
	this.registerMany = function(components, type) {
    for (var k in components) 
      if (components.hasOwnProperty(k) && components[k].length > 0) 
        for (var i = 0; i < components[k].length; i++) 
          if (components[k][i] != null)
            this.register(k + '.' + components[k][i], false, type);
  }
  
  this.checkWaiting = function(file, components, type) {
		var	type = type || 'javascript',
				waiting = this.waiting[type],
				flag = true;
    
		for (var i=0; i<components.length; i++) {
			if (waiting[components[i]]) {
				flag = false;
				
				break;
			}
		}
		
		if (flag) 
			this.done(file);
  }
	
	this.getComponents = function(url) {
		var	ret = [],
				url = url.split('?'),
				page = url[0],
				parms = url.length > 1
					? url[1].split('&')
					: [];
		
		for (var i=0; i<parms.length; i++) {
			var parm = parms[i].split('='),
					files = parm[1].split('+');
			
			for (var f=0; f<files.length; f++) {
				file = parm[0] +'.'+ files[f];
				
				ret.push(file);
			}
		}
		
		return ret;
	}
	
	this.wait = function(url, type) {
		var	type = type || 'javascript',
				registered = this.registered[type],
				waiting = this.waiting[type],
				components = this.getComponents(url);
		
		for (var i=0; i<components.length; i++)
			if (!registered[components[i]]) 
				waiting[components[i]] = true;
		
		url = this.url(waiting);
		
		for (var key in waiting)
			waiting[key] = '/' + (type == 'css' ? 'css' : 'scripts') + '/main' + url;
		
		return url;
	}
	
	this.url = function(oParms) {
		var	parms = {},
				ret = '';
		
		for (var key in oParms) {
			parm = key.split('.');
			
			if (!parms[parm[0]])
				parms[parm[0]] = [];
			
			parms[parm[0]].push(parm[1]);
		}
		
		for (var key in parms) {
			ret += (ret == '' ? '?' : '&') + key + '=';
			
			for (var i=0; i<parms[key].length; i++) {
				if (parms[key][i] != 'map')
					ret += parms[key][i] + (i == parms[key].length-1?'':'+');
				else if (i == parms[key].length-1)
					ret = ret.substr(0,ret.length-1);
			}
		}
		
		if (ret.indexOf("=") < 0)
			ret = '';
		
		return ret;
	}
	
	this.done = function(oFile) {
    if (typeof oFile != 'undefined') {
  		oFile.loaded = true;
			
	  	if (oFile.batch)
		  	oFile.batch.done(oFile.url);
    }
	}
	
	this.add = function(url, batch, type, component) {
		var	file = this.files[url] || {},
				type = type || 'javascript';
		
		if (!elation.utils.isNull(file.url)) {
			if (batch) {
				batch.done(url);
				
				return file;
			}
		}
		
		if (component || type == 'css') {
			url = this.wait(url, type);
			
			if (url) 
				url = '/' + (type == 'css' ? 'css' : 'scripts') + '/main' + url;
			else 
				return false;
		}
		
		file.batch = batch;
		file.loaded = false;
		file.url = url;
		file.type = type;
		file.element = elation.file.get(type, this.host + url, (
			(component)
				? null
				: (function(self) { 
						self.done(file); 
					})(this)
		));
		
		this.files[url] = file;
		
		return file;
	}
});

elation.extend('ui.getCaretPosition', function(oField) {
	// Initialize
	var iCaretPos = 0;

	// IE Support
	if (document.selection) { 
		// Set focus on the element
		oField.focus();
		
		// To get cursor position, get empty selection range
		var oSel = document.selection.createRange ();
		
		// Move selection start to 0 position
		oSel.moveStart('character', -oField.value.length);
		
		// The caret position is selection length
		iCaretPos = oSel.text.length;
	}
	
	// Firefox support
	else if (oField.selectionStart || oField.selectionStart == '0')
		iCaretPos = oField.selectionStart;
	
	// Return results
	return iCaretPos;
});


/*
**  Sets the caret (cursor) position of the specified text field.
**  Valid positions are 0-oField.length.
*/
elation.extend('ui.setCaretPosition', function(oField, iCaretPos) {
	// IE Support
	if (document.selection) { 
		// Set focus on the element
		oField.focus();
		
		// Create empty selection range
		var oSel = document.selection.createRange ();
		
		// Move selection start and end to 0 position
		oSel.moveStart('character', -oField.value.length);
		
		// Move selection start and end to desired position
		oSel.moveStart('character', iCaretPos);
		oSel.moveEnd('character', 0);
		oSel.select();
	}
	
	// Firefox support
	else if (oField.selectionStart || oField.selectionStart == '0') {
		oField.selectionStart = iCaretPos;
		oField.selectionEnd = iCaretPos;
		oField.focus();
	}
});

elation.extend('ui.combobox', function(parent, callback) {
	this.visible = false;
	this.parent = parent;
	this.callback = callback;
	
	this.init = function() {
		var	selects = elation.find("select.tf_search_input_sub_navigation", this.parent),
				select, dim, combobox, label, button, ul, lis, img, option, actions, options;
		
		for (var i=0; i<selects.length; i++) {
			select = selects[i];
			options = [];
			
			combobox = this.combobox = elation.html.create({
				tag: 'div',
				classname: 'tf_combobox',
				append: select.parentNode,
				before: select
			});
			
			label = this.label = elation.html.create({
				tag: 'div',
				classname: 'tf_combobox_label',
				append: combobox
			});
			
			button = this.button = elation.html.create({
				tag: 'div',
				classname: 'tf_combobox_button',
				append: combobox
			});
			
			img = elation.html.create({
				tag: 'div',
				classname: 'tf_combobox_image',
				append: button
			});			
			
			ul = this.ul = elation.html.create({
				tag: 'ul',
				classname: 'tf_combobox_options',
				append: combobox
			});
			
			label.innerHTML = select.options[select.selectedIndex].innerHTML;
			
      for (var s=0; s<select.options.length; s++) {
				option = select.options[s];
				
				li = elation.html.create({
					tag: 'li',
					classname: 'tf_combobox_option',
					append: ul,
					attributes: {
						innerHTML: option.innerHTML
					}
				});
				
				options.push({ 
					li: li, 
					label: option.innerHTML, 
					value: option.value 
				});
			}
			
			this.options = options;
			this.actions = actions;
			this.ul.style.display = 'block';
			this.height = this.ul.offsetHeight;
			this.ul.style.display = 'none';
			
      elation.events.add(combobox, 'click', this);
			
			select.parentNode.removeChild(select);
		}
	}
	
	this.show = function() {
		this.visible = true;
		
		elation.html.addclass(this.button, 'selected');
		
		$(this.ul)
			.css({display: 'block', height: 0})
			.animate({height: this.height + 'px'}, 150, "easein");
	}
	
	this.hide = function() {
		this.visible = false;
		
		elation.html.removeclass(this.button, 'selected');
		
		(function(self) {
			$(self.ul)
				.animate({height: 0}, 200, "easeout", function() {self.ul.style.display = 'none';});
		})(this);
	}
	
	this.toggle = function(target) {
		this.visible
			? this.hide()
			: this.show();
		
		if (target.nodeName == 'LI')
			this.callback(target, this);
	}
	
	this.handleEvent = function(event) {
		var type = event.type || window.event,
				target = event.target || event.srcElement;
		
		switch (type) {
			case 'click':this.toggle(target);break;
			case 'mouseover':break;
			case 'mouseout':break;
		}
	}
	
	this.init();
});

elation.extend('ui.infoboxes.infobox_stores', function() {
  $TF.get("/facebook/stores_match.html", function(html){
    elation.ui.lightbox.show(html);
  });
});

elation.extend('ui.infoboxes.tell_more_friends', function() {
	var callback = window.location.href;
	
	return elation.ui.lightbox.get("/facebook/tell_more_friends.snip","callback="+encodeURIComponent(callback));
});
elation.extend('ui.infoboxes.infobox_privacy_settings', function() {
	return elation.ui.lightbox.get("/user/privacy_settings.html");
});

elation.extend('ui.infoboxes.twitter_form', function() {
  var form = document.getElementById('tf_share_twitter'),
			item = elation.results.activeitem(),
			infobox = elation.ui.infobox.get('product_infocard'),
			href = window.location.href.split('#')[0],
			query = elation.searches.tf_search_examplesearch.args.query,
			shortHREF = '';
  
  if (query) {
  	var message = "\n\nI've searched for " + query + " on @TheFind. Look at these great products I found!";
  } else {
  	var message = "\n\nTake a look at these great results at TheFind.com";
  }
  
  if (item && infobox && infobox.visible) {
  	href += '&ddkey=' + item.ddkey;
  }

  function setMessage(args) {
    if(shortHREF) {
      href = shortHREF;
    }
    
    if (item && infobox && infobox.visible) {
      message = "I'm looking at " + item.title + ", " + href + " on @TheFind.";
      form.msg.innerHTML = message;
    }
    else {
      form.msg.innerHTML = href + message;
    }               
  }
  
  $TF.ajax({
    url: '/utils/shorturl.js',
    data: 'url=' + encodeURIComponent(href),
    dataType: 'json',
    type: 'GET',
    timeout: 5000,
    success: function(data, textStatus) {
      shortHREF = data.data.shorturl;
      setMessage();
    },
    error: function(XMLHttpRequest, textStatus, errorThrown) {
      setMessage();
    }
  });
  
  /*
  ajaxlib.Queue({
  	method: 'GET',
  	url: '/utils/shorturl.js',
  	args: 'url=' + encodeURIComponent(href),
  	callback: [this, function(args) {
  		//try {
  		var response = elation.JSON.parse(args);
  		shortHREF = href = response.data.shorturl;
  		//}
  		//catch(e) {}
  		setMessage();
  	}
  ]	,
  	failurecallback: [this, function() {
  		setMessage();
  	}
  ]	,
  	timeoutcallback: [this, function() {
  		setMessage();
  	}
  ]
  });
  
  ajaxlib.Get('utils/shorturl.js?url=' + encodeURIComponent(href), null, {
  	callback: function(args) {
  		var response = elation.JSON.parse(args);
  		shortHREF = href = response.data.shorturl;
  		setMessage();
  	},
  	failurecallback: setMessage,
  	timeout: 5000,
  	timeoutcallback: setMessage
  });
  */
});

elation.extend('ui.infoboxes.email_form', function(args) {
	var	args = args || {},
      data = elation.user.user,
			to = document.getElementById('myfindsSendEmailToEmail'),
			from = document.getElementById('myfindsSendEmailFromEmail'),
			name = document.getElementById('myfindsSendEmailFromName'),
			msg = document.getElementById('myfindsSendEmailMessage'),
      url = window.location.href.split('#')[0]
      sep = url.split('?').length > 1 ? '&' : '?';
	
	if (from && data.email)
		from.value = data.email;
	
	if (name && data.nickname)
		name.value = data.nickname;
	
	if (msg) 
  	if (elation.utils.arrayget(args, "isproduct")) {
  		msg.value  = "I just discovered this product on TheFind and wanted to share it with you.\n\n" + url + sep + "ddkey=" + elation.utils.arrayget(args, 'ddkey') + "\n\n";
  	}
  	else {
  		msg.value = "I just discovered these products on TheFind and wanted to share them with you.\n\n" + url + "\n\nCheck them out!";
  	}
	
	if (to)
		to.focus();
});

elation.extend('data', new function() {
	this.add = function(name, data) {
		if (!this[name])
			this[name] = [];
		
		for (var i=0; i<data.length; i++)
			this[name].push(data[i]);
	}
	
	this.find = function(name, path, value) {
		if (elation.utils.isNull(this[name]))
			return false;
		
		for (var i=0; i<this[name].length; i++) {
			var item = this[name][i],
					property = elation.utils.arrayget(item, path);
			
			if (property == value)
				return item;
		}
		
		return false;
	}
});

// execute callback onhover
elation.extend('ui.hover', function() {
  this.init = function(element, mouseover, mouseout, alternate, click) {
    if (!element || !mouseover || !mouseout)
      return;
    
    this.element = element;
    this.mouseover = mouseover;
    this.mouseout = mouseout;
		this.click = click;
    this.alternate = alternate || element;
    
    elation.events.add(element, "mouseover,mouseout", this);
    
		// onclick is optional
		if (click)
			elation.events.add(this.alternate, "click", this);
  }
  
  this.handleEvent = function(event) {
    var	event = this.event = event || window.event,
        target = this.target = event.target || event.srcElement,
				related = this.related = elation.events.getRelated(event);
    
		if (this.checkRelated(target, related))
			return;
		
    switch(event.type) {
      case "mouseover":
        this.mouseover();
        break;
      
      case "mouseout":
        this.mouseout();
        break;
      
			case "click":
        this.click();
        break;
    }
  }
	
	this.checkRelated = function(target, related) {
 		while (!elation.utils.isNull(related)) { 
 			if (related == this.element)
				return true;
			
			related = related.parentNode;
		}
		
		return false;
	}
});

elation.extend('log_size', function(result_view_id) {
	if (typeof result_view_id == 'undefined')
		result_view_id = '';
	
	if (window.innerWidth) 
		var	tr_width = window.innerWidth,
				tr_height = window.innerHeight;
	else 
		if (document.body.offsetWidth) 
			var	tr_width = document.body.offsetWidth,
					tr_height = document.body.offsetHeight;
	
	if (elation.ajax) {
    elation.ajax.Get('/page/sizelog?width=' + tr_width + '&height=' + tr_height + '&result_view_id=' + result_view_id);
  }
});
elation.extend("utils.escapeHTML", function(str) {
   var div = document.createElement('div');
   var text = document.createTextNode(str);
   div.appendChild(text);
   return div.innerHTML;
});

tr_size = elation.log_size;

/* Return first non-empty value from list of args, or null if all are empty
* Empty string, null and undefined are considered 'empty' and skipped over
* Numeric 0 is considered non-empty and returned
*/
function any() {
	var arg;
	for (var i=0; i<arguments.length; i++) {
		if (((arg=arguments[i]) !== null) && (arg !== "") && (typeof arg !== "undefined")) return arg;
	}
	return null;
}

/**
 * Google analytics tracking class and object
 */
elation.extend('googleanalytics', function(args) {
  this.GAalerts = Number(args.GAalerts);
  this.trackingcode = args.trackingcode;
  this.cobrand = args.cobrand;
  this.query = args.query;
  this.pagegroup = args.pagegroup;
  this.pagetype = args.pagetype;
  this.status = args.status;
  this.total = args.total;
  this.category = args.category;
  this.subcategory = args.subcategory;
  this.city = args.city;
  this.state = args.state;
  this.country = args.country;
  this.pagenum = args.pagenum;
  this.filters = args.filters;
  this.version = args.version;
  this.store_name = args.store_name;
  this.alpha = args.alpha;
  this.clickoutsource = 0;
  this.myfindspanel = '';
  this.mouseovertype = '';
  this.mouseovereventenable = 1;
  this.pageTracker = _gat._getTracker(this.trackingcode);
  this.pageTracker._setCookieTimeout("172800"); // campaign tracking expiration 2 days

  var self = this;
  var ignoredOrganics=['www.thefind.com', 'thefind', 'thefind.com', 'the find', 'glimpse', 'glimpse.com', 'www.glimpse.com', 'local.thefind.com', 'green.thefind.com', 'ww1.glimpse.com', 'shoptrue.com', 'shoptrue', 'coupons.thefind.com', 'shop.glimpse.com', 'ww1.thefind.com', 'www.shoptrue.com', 'reviews.thefind.com', 'visual.thefind.com', 'prices.thefind.com'];
  $.each(ignoredOrganics, function() {self.pageTracker._addIgnoredOrganic(this)});

  var domainName = document.domain.match(/(\.(.+)\.com$)/gi);
  if(domainName == null) {
    domainName = document.domain.match(/(\.(.+)\.co\.uk$)/gi);
  }
  domainName = domainName[0];

  if (this.cobrand=='local' || this.cobrand=='greenshopping' || this.cobrand=='visualbeta' || this.cobrand=='coupons' || this.cobrand=='thefind' || this.cobrand=='thefindww1' || this.cobrand=='reviews' || this.cobrand=='prices') {
    this.pageTracker._setDomainName(domainName); // set to '.thefind.com' or '.dev.thefind.com'
    this.pageTracker._setAllowLinker(true);
    this.pageTracker._setAllowHash(false);
  }else if (this.cobrand=='glimpse' || this.cobrand=='glimpseww1' || this.cobrand=='glimpseshop') {
    this.pageTracker._setDomainName(domainName); //set to '.glimpse.com'
    this.pageTracker._setAllowLinker(true);
    this.pageTracker._setAllowHash(false);
  }else if (this.cobrand=='shoptrue') {
    this.pageTracker._setDomainName(domainName); //set to '.shoptrue.com'
    this.pageTracker._setAllowLinker(true);
    this.pageTracker._setAllowHash(false);
  }else if (this.cobrand=='thefinduk') {
    this.pageTracker._setDomainName(domainName); //set to '.thefind.co.uk'
    this.pageTracker._setAllowLinker(true);
    this.pageTracker._setAllowHash(false);
  }

  // attach event handlers to various static links
  $("a.tf_search_item_link.tf_search_item_productimage_link").click(function () {if (!self.clickoutsource) self.clickoutsource = 1}); // product image
  $("a.tf_search_item_link.tf_seeit strong img").click(function () {if (!self.clickoutsource) self.clickoutsource = 2}); // merchant logo
  $("a.tf_search_item_link.tf_seeit").click(function () {if (!self.clickoutsource) self.clickoutsource = 3}); // VisitSite button
  $("a.tf_search_item_link.tf_seeit strong").click(function () {if (!self.clickoutsource) self.clickoutsource = 4}); // intervening blankspace
  $(".search_anchor_relatedqueries").each(function(n) {$(this).click(function() {self.trackEvent(['search', 'related_search', n+1])})});
  $(".search_anchor_hotsearches").each(function(n) {$(this).click(function() {self.trackEvent(['links', self.pagetype, 'hot_searches', n+1])})});
  $(".tf_info_iphonedownload").click(function() {self.trackEvent(['promo', 'bottom', 'iPhoneApp'])});
  $(".tf_user_feedback_link").each(function(n) {$(this).click(function() {self.trackEvent(['links', self.pagetype, 'user_feedback', n+1])})});
  $(".tf_about_results_link").each(function(n) {$(this).click(function() {self.trackEvent(['links', self.pagetype, 'about_these_search_results', n+1])})});
  $(".link_icon_discover_same_product").each(function(n) {$(this).click(function() {self.trackEvent(['discover', 'same_product', self.category])})});
  $(".link_icon_discover_similar_product").each(function(n) {$(this).click(function() {self.trackEvent(['discover', 'similar_product', self.category])})});
  $(".search_anchor_suggestqueries").each(function(n) {$(this).click(function() {self.trackEvent(['links', 'recommendedSearches', this.innerHTML])})});
  $("#tf_shoplikefriends_tellmorefriends").click(function() {self.trackEvent(['facebook', 'invite_friends'])});
  $("#tf_shoplikefriends_becomefeaturedshopper").click(function() {self.trackEvent(['shoplike', 'become_featured_shopper'])});

  //Links above first searchbox for products, coupons, reviews
  $("#tf_search_links_products").click(function() {self.trackEvent(['links', 'theWeb', 'products'])});
  $("#tf_search_links_coupons").click(function() {self.trackEvent(['links', 'theWeb', 'coupons'])});
  $("#tf_search_links_reviews").click(function() {self.trackEvent(['links', 'theWeb', 'reviews'])});


  //Merchantcenter footer link tracking
  $('#tf_footer_merchantcenter').click(function() {
    self.trackEvent(['merchant_center', self.cobrand, self.pagetype]);
    if (self.query != 'none') {
      self.trackEvent(['merchant_center', 'serp_footer', self.cobrand]);
    }
    else {
      self.trackEvent(['merchant_center', 'home_footer', self.cobrand]);
    }
  });

  //Don't know if the below ever gets fired ... 
  $('#tf_middle_bottom_merchantcenter').click(function() {
    self.trackEvent(['merchant_center', self.cobrand, self.pagetype]);
    self.trackEvent(['merchant_center', 'home_retailer', self.cobrand]);
  });


	delete self;

	if (this.GAalerts) {
    $('body').append(
      '<div id="ga_tagbox" style="position:fixed;left:0;top:0;border:1px dotted black;padding:5px;background-color:#eef;text-align:left;display:none"></div>'
    );
    $('#ga_tagbox').css('opacity', 0.9).click(function() {$(this).css('display', 'none')});
  }

  this.displayTag = function(content) {
    $('#ga_tagbox').append(content+'<br \/>').css('display', 'block');
  };

  this.updatePageParameters = function(args) {
    this.pagenum = (args['filter[pagenum]'] || args['page'] || "1");
    this.filters = args['brand']?'1':'0';
    this.filters += args['color']?'1':'0';
    this.filters += Number(args['coupons'])?'1':'0';
    this.filters += Number(args['local'])?'1':'0';
    this.filters += Number(args['green'])?'1':'0';
    this.filters += Number(args['marketplaces'])?'1':'0';
    this.filters += (args['filter[price][min]']||args['filter[price][max]']||args['price'])?'1':'0';
    this.filters += Number(args['sale'])?'1':'0';
    this.filters += args['store']?'1':'0';
    this.filters += args['freeshipping']?'1':'0';
  };

  this.setCustomVar = function(index, name, value, opt_scope) {
    try {
       this.pageTracker._setCustomVar(index, name, value, opt_scope);
       if (this.GAalerts) this.displayTag('setCustomVar(' + index + ', ' + name + ', ' + value + ', ' + opt_scope + ')');
    } catch (err) {
       if (this.GAalerts) this.displayTag("setCustomVar Error: " + err.description);
    }
  };

  this.trackPageViewWrapper = function(pageurl) {
    try {
      this.pageTracker._trackPageview(pageurl);
      if (this.GAalerts) {
        this.displayTag('trackPageview('+pageurl+')');
      }
    } catch (err) {if (this.GAalerts) this.displayTag("trackPageViewWrapper Error: " + err.description)}
  };

  this.trackPageview = function() {
    var status = this.status;
    var total = this.total;
    var pagegroup = this.pagegroup;
    var pagetype = this.pagetype;
    var query = this.query.replace(/&/g, "+");
    var errorPages = {
      'B1':'noresults',
      'B2':'noorganicresults',
      'B3':'noresults',
      'B4':'noresultscurrentmall',
      'B5':'partialresults',
      'S1':'serverexception',
      '404':'error_404'};

    //console.log(this.pagetype);
    //special cases for myfinds and shoplikeme / shoplikefriends
    if(this.pagetype == 'myfinds') {
      return;
    }

    $.each(errorPages, function(k,v) {
      if (k==status && (status!='B3' || total=='0')) {
        query = pagetype+"-"+query;
        pagegroup = "error";
        pagetype = v;
      }
    });

    if (this.pagetype=='error_404') this.query = '?page='+document.location.href  + '&from=' + document.referrer;

    //TODO!!: check above format with Srilatha -- does not report properly
    var pageurl = 'virt_'+pagegroup
                + '/'+this.cobrand;

    //console.log(this.pagetype);

    switch (this.pagetype) {
      case 'coupons_index':
        pageurl += '/'+pagetype;
        break;
      case 'coupons_browsemap':
        pageurl += '/'+pagetype;
        pageurl += '/'+this.alpha;
        break;
      case 'coupons_store':
      case 'store':
        pageurl += '/'+pagetype;
        pageurl += '/'+this.store_name;
      	if (document.referrer && document.referrer.search('=') == -1) {
                pageurl += '/?qry='+this.store_name;
              } else {
      	  pageurl += '/?qry='+query;
      	}
        pageurl += '&flt='+this.filters
                + '&pgn='+this.pagenum
                + '&ver='+this.version;
        break;
      case 'coupons_tag':
        pageurl += '/coupons'; // pagetype in GA should be 'coupons'
        pageurl += '/'+this.category
                + '/'+this.subcategory
                + '/?qry='+query
                + '&flt='+this.filters
                + '&pgn='+this.pagenum
                + '&ver='+this.version;
        break;
      case 'merchant-register':
        pageurl += '/upfront/email/';
        break;
      default:
        pageurl += '/'+pagetype;
        pageurl += '/'+this.category
                + '/'+this.subcategory
                + '/?qry='+query
                + '&flt='+this.filters
                + '&pgn='+this.pagenum
                + '&ver='+this.version;
        break;
    }
    if (this.GAalerts) this.displayTag('trackPageview('+pageurl+')');

    try {
      this.pageTracker._trackPageview(pageurl);
    } catch (err) {if (this.GAalerts) this.displayTag("trackPageview Error: "+err.description)}
  };

  this.trackEvent = function(args) {
    switch (args.length) {
      case 2:
        if (this.GAalerts) this.displayTag('trackEvent('+args[0]+','+args[1]+')');
        try {
          this.pageTracker._trackEvent(args[0], args[1]);
        } catch (err) {if (this.GAalerts) this.displayTag("trackEvent Error: "+err.description)}
        break;
      case 3:
        if (this.GAalerts) this.displayTag('trackEvent('+args[0]+','+args[1]+','+args[2]+')');
        try {
          this.pageTracker._trackEvent(args[0], args[1], args[2]);
        } catch (err) {if (this.GAalerts) this.displayTag("trackEvent Error: "+err.description)}
        break;
      case 4:
        if (this.GAalerts) this.displayTag('trackEvent('+args[0]+','+args[1]+','+args[2]+','+args[3]+')');
        try {
          this.pageTracker._trackEvent(args[0], args[1], args[2], Number(args[3]));
        } catch (err) {if (this.GAalerts) this.displayTag("trackEvent Error: "+err.description)}
        break;
    }
  };

  this.trackClickout = function(args) {
    this.trackEvent([args.event[0], args.event[1], args.event[2] + args.event[3]]);
    this.clickoutsource=0;
    this.myfindspanel='';
    var orderID = Math.floor(Math.random()*1000000000000);
    if (this.GAalerts) {
      this.displayTag('addTrans('+orderID+','+args.trans[0]+','+args.trans[1]+',"","",'+this.city+','+this.state+','+this.country+')');
      this.displayTag('addItem('+orderID+','+args.item[0]+','+args.item[1]+','+args.item[2]+','+args.item[3]+','+args.item[4]+')');
    }
    try {
      this.pageTracker._addTrans(orderID, args.trans[0], args.trans[1], "", "", this.city, this.state, this.country);
      this.pageTracker._addItem(orderID, args.item[0], args.item[1], args.item[2], args.item[3], args.item[4]);
      this.pageTracker._trackTrans();
    } catch (err) {if (this.GAalerts) this.displayTag("trackTrans Error: "+err.description)}
  };

  this.trackPrivacySettings = function() {
    var perm = $('#user_privacy').val();
    var permTxt = '';

    switch (perm) {
      case '0':
        permTxt = 'everyone';
        break;
      case '1':
        permTxt = 'friendsonly';
        break;
      case '2':
        permTxt = 'justme';
        break;
    }

    if (permTxt) {
      this.trackEvent(['permissions', 'shoplikeme', permTxt]);
    }
  };
});

TFHtmlUtilsGoogleAnalytics = elation.googleanalytics;

/**
 * This is used for something apparently
 */
function TFHtmlUtilsPandoraLog() {
  this.mouseovertype = "";
}

/*
 * This function will checkall / uncheckall the checkboxes in a form.
 * state: true (check), false (uncheck)
 */
function checkall(link, state) {
  while (link.tagName != 'FORM')
    link = link.parentNode;

  var	form = link,
			inputs = form.getElementsByTagName('input'),
			checkboxes = new Array();

	for (i=0; i<inputs.length; i++)
		if (inputs[i].type == 'checkbox')
			inputs[i].checked = state;
}
