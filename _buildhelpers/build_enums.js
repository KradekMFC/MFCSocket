var fs = require( 'fs' ),
	http = require( 'http' );

// parses the FCS.js definitions into an object 
function parseFCS( body ){
	//var re = /FCS\.(\S+?)_(\S+)\s+=\s+(\d+);/g, // for use with lib/mfccore.js
	var re = /@const \*\/\s+FCS\.([^_]+)_(\S+)\s+=\s+(\d+);/g, // for use with lib/FCS.js
		match,
		fcs = {'enums':{},'build_version':'0'};
	
	// parse all of the individual event entries
	while( match = re.exec( body ) ){ // 1 = major type ("FCCHAN"), 2 = minor type ("ERR_NOCHANNEL"), 3 = code ("2")
		if( !fcs.enums.hasOwnProperty( match[1] ) ){
			fcs.enums[match[1]] = {};
		}
		fcs.enums[match[1]][match[1]+'_'+match[2]] = parseInt( match[3], 10 ); // fcs["FCCHAN"]["FCCHAN_ERR_NOCHANNEL"] = 2;
    }
    
    // grab the version of the FCS.js file
    match = /auto-generated \(v([^\)]+)\)/.exec( body );
    fcs.build_version = match[1]; // "20131111.1"

	return fcs;
}

// loops through a parseFCS() object and formats javascript for all events, grouped by type
function formatEnums( fcs ){
	var output = '// Enum types for MFC (built from lib/FCS.js v' + fcs.build_version + ')\n' +
				 '// This file is automatically created by the build process. DO NOT EDIT!\n\n' +
				 'var MFCEnums = {\n';
	
	// loop through major types ("FCCHAN")
	for( var majortype in fcs.enums ){
		if( fcs.enums.hasOwnProperty( majortype ) ){
			// determine the human-readable name for the current major type
			// FIXME: figure out the meanings and give appropriate names to all of the commented-out types below
			var majortype_varname = 'Unknown_' + majortype;
			switch( majortype ){
				case 'FCTYPE':
					majortype_varname = 'MessageType';
					break;
				case 'FCRESPONSE':
					majortype_varname = 'ResponseType';
					break;
				case 'FCLEVEL':
					majortype_varname = 'AccessLevel';
					break;
				case 'FCCHAN':
					majortype_varname = 'ChatOpt';
					break;
				/*
				case 'FCGROUP':
					majortype_varname = 'FCGROUP';
					break;
				case 'FCACCEPT':
					majortype_varname = 'FCACCEPT';
					break;
				case 'FCNOSESS':
					majortype_varname = 'FCNOSESS';
					break;
				case 'FCMODEL':
					majortype_varname = 'FCMODEL';
					break;
				case 'FCUCR':
					majortype_varname = 'FCUCR';
					break;
				case 'FCUPDATE':
					majortype_varname = 'FCUPDATE';
					break;
				case 'FCOPT':
					majortype_varname = 'FCOPT';
					break;
				case 'FCBAN':
					majortype_varname = 'FCBAN';
					break;
				case 'FCNEWSOPT':
					majortype_varname = 'FCNEWSOPT';
					break;
				case 'FCSERV':
					majortype_varname = 'FCSERV';
					break;
				*/
				case 'FCVIDEO':
					majortype_varname = 'VideoState';
					break;
				/*
				case 'MYWEBCAM':
					majortype_varname = 'MYWEBCAM';
					break;
				case 'EVSESSION':
					majortype_varname = 'EVSESSION';
					break;
				case 'TKOPT':
					majortype_varname = 'TKOPT';
					break;
				case 'FCWOPT':
					majortype_varname = 'FCWOPT';
					break;
				*/
			}
			
			// begin outputting the current major type
			output += '\tMFC' + majortype_varname + ' : {\n';
			
			// output all of the minor types for the current major type
			for( var minortype in fcs.enums[majortype] ){
				if( fcs.enums[majortype].hasOwnProperty( minortype ) ){
					output += '\t\t' + minortype + ' : ' + fcs.enums[majortype][minortype] + ',\n';
				}
			}
			
			// end output of the current major type
			output += '\t},\n';
		}
	}
	
	output += '}\n\nmodule.exports = MFCEnums;';
	
	return output;
}

// grab the FCS object directly from "FCS.js"; it contains all of their numerical message type codes.
// we could also grab the compiled "mfccore.js" file instead, but that one lacks the version comment.
http.get({ host:'myfreecams.com', port:80, path:'/mfc2/lib/FCS.js' }, function( res ) {
	var body = '';
	res.on( 'data', function( chunk ){
		body += chunk;
	});
	res.on( 'end', function(){
		// parse and format the enums
		var enumJS = formatEnums( parseFCS( body ) );
		
		// write the file to disk
		fs.writeFile( '../lib/MFCEnums.js', enumJS, function( err ) {
			if( err ) throw err;
			console.log( 'Build: MFCEnums.js: Written to disk!' );
		});
	});
}).on( 'error', function( e ){
	console.log( 'Build: MFCEnums.js: Scraping failed:' + e.message );
});