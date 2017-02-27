process.env.GOPATH = __dirname;

//Hyperledger Fabric Client SDK for Node.js (SDK-Demo\node_modules\hfc)
var hfc = require('hfc');
var util = require('util');
var fs = require('fs');
const https = require('https');

var config;
var chain;
var network;
var certPath;
var peers;
var users;
var userObj;
var newUserName;
var chaincodeID;
var certFile = 'us.blockchain.ibm.com.cert';
var chaincodeIDPath = __dirname + "/chaincodeID";


var caUrl;
var peerUrls = [];
var EventUrls = [];

//IBC
// var Ibc1 = require('ibm-blockchain-js');                                                        //rest based SDK for ibm blockchain
// var ibc = new Ibc1();

init();
setup();
//creaNodo();
 
crearUsuario();
//obtenerInfoUsuario("KEY");
//firmarCampo("KEY", "diccionarioDireccion");
obtenerInfoUsuario("KEY");

//Inicialización de la aplicación. Este es el primer metodo invocado.
function init() {
	try {
        //Cargamos la configuración del archivo config.json
        config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
    } catch (err) {
      	console.log("config.json is missing or invalid file, Rerun the program with right file")
      	process.exit();
    }

    // Creamos un blockchain llamado "hello-world". El API para trabajar con el chaincode, mediante la variable chain, se encuentra
    // en https://github.com/hyperledger/fabric-sdk-node/blob/master/docs/index.md
    chain = hfc.newChain(config.chainName);
    //Ruta del certificado a utilizar en la red de blockchain
    certPath = __dirname + "/certificate.pem";

    // Leemos las credenciales de nuestra red de blockchain, contenidas en ServiceCredentials.json
    try {
    	network = JSON.parse(fs.readFileSync(__dirname + '/ServiceCredentials.json', 'utf8'));
    	if (network.credentials) network = network.credentials;
    } catch (err) {
    	console.log("ServiceCredentials.json is missing or invalid file, Rerun the program with right file")
    	process.exit();
    }

    //Nodos de validación de la red de blockchain. Al crear la instancia en Bluemix, nos asignan 4 nodos. Se pueden ver en el Dashboard.
    peers = network.peers;

    //Nodos que van a interactuar dentro de la red de blockchain, para el intercambio de información.
    users = network.users;
  }
function setup() {
    // HSBN = High Security Business Network. En caso de ser una red de este tipo, necesitamos un certificado de seguridad para
    // operar en ella.
    // Determining if we are running on a startup or HSBN network based on the url
    // of the discovery host name.  The HSBN will contain the string zone.
    var isHSBN = peers[0].discovery_host.indexOf('secure') >= 0 ? true : false;
    var network_id = Object.keys(network.ca);
    caUrl = "grpcs://" + network.ca[network_id].discovery_host + ":" + network.ca[network_id].discovery_port;

    // Configure the KeyValStore which is used to store sensitive keys.
    // This data needs to be located or accessible any time the users enrollmentID
    // perform any functions on the blockchain.  The users are not usable without
    // This data.
    var uuid = network_id[0].substring(0, 8);
    chain.setKeyValStore(hfc.newFileKeyValStore(__dirname + '/keyValStore-' + uuid));

    if (isHSBN) {
    	certFile = '0.secure.blockchain.ibm.com.cert';
    }
    fs.createReadStream(certFile).pipe(fs.createWriteStream(certPath));
    var cert = fs.readFileSync(certFile);

    chain.setMemberServicesUrl(caUrl, {
    	pem: cert
    });

    peerUrls = [];
    eventUrls = [];
    // Adding all the peers to blockchain
    // this adds high availability for the client
    for (var i = 0; i < peers.length; i++) {
            // Peers on Bluemix require secured connections, hence 'grpcs://'
            peerUrls.push("grpcs://" + peers[i].discovery_host + ":" + peers[i].discovery_port);
            chain.addPeer(peerUrls[i], {
            	pem: cert
            });
            eventUrls.push("grpcs://" + peers[i].event_host + ":" + peers[i].event_port);
            chain.eventHubConnect(eventUrls[0], {
            	pem: cert
            });
          }

    //Inicializa el usuario con el que vamos a trabajar con la red de Blockchain y que está definido
    //en config.json
    newUserName = config.user.username;

    // Make sure disconnect the eventhub on exit
    process.on('exit', function() {
    	chain.eventHubDisconnect();
    });
}

//Registra usuarios en la red de blockchain y despliega el chaincode.
function creaNodo() {

  // Registramos al usuario admin.
  // La variable chain se inicializó con la referencia a la red de blockchain.
 	chain.enroll(users[0].enrollId, users[0].enrollSecret, function(err, admin) {
  	if (err) throw Error("\nERROR: failed to enroll admin : " + err);

  	console.log("\nEnrolled admin sucecssfully");

          // Set this user as the chain's registrar which is authorized to register other users.
          chain.setRegistrar(admin);

          //Registramos al usuario JohnDoe definido en el archivo config.json
          var registrationRequest = {
          	enrollmentID: newUserName,
          	affiliation: config.user.affiliation
          };
          chain.registerAndEnroll(registrationRequest, function(err, user) {
          	if (err) throw Error(" Failed to register and enroll " + newUserName + ": " + err);

          	console.log("\nEnrolled and registered " + newUserName + " successfully");
          	process.exit(1);
          });
        });
}

function crearUsuario() {
	console.log("crearUsuario");

	//Agreguemos algo a ver que rollo
	var user = {};
	user.username = "JOAQUIN";
	user.lastName = "LOPEZ";
	user.familyName = "DORIGA";
	user.diccionarioDireccion = {}
	user.diccionarioDireccion.direccion = "DIRECCION";
	user.diccionarioDireccion.firma = false;

	var string = JSON.stringify(user);

	chain.getKeyValStore().setValue("KEY", string, function(err) {
		if(err) throw Error("ERROR AL AGREGAR" + err);

		console.log("Se agregó al chaincode");
	});
}

function obtenerInfoUsuario(usuario) {
	console.log("obtenerInfoUsuario");

	chain.getKeyValStore().getValue(usuario, function(err, value) {
		if(err) throw Error("IMPOSIBLE LEER CHAVO" + err);

		console.log("SE OBTUVO: " + value);
	});

  //var obj = JSON.parse(text);

}

function firmarCampo(usuario, campo) {
	console.log("firmarCampo")

	chain.getKeyValStore().getValue(usuario, function(err, value) {
		if(err) throw Error("Error al firmar"+ err);

		valores = JSON.parse(value);
		if(valores[campo]) {
			valores[campo].firma=true;
			actualizarUsuario(usuario, valores);
		} else {
			console.log("NO SE PUEDE FIRMAR UN CAMPO QUE NO EXISTE CHAVAL")
		}
	})
}

function actualizarUsuario(usuario, campos) {
	chain.getKeyValStore().setValue(usuario, JSON.stringify(campos), function(err) {
		if(err) throw Error("ERROR AL AGREGAR" + err);

		console.log("Se agregó al chaincode");
	});
}
