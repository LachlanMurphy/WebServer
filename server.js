function random(min, max) {
	return Math.round(Math.random() * (max - min) + min);
}

// Import packages
let express = require('express');
let fs = require('fs');

let port = 3000;
let path = "public";

let app = express();
let server = app.listen(port);
app.use(express.static(path));

/*
 * This is technically importing a package but
 * in order to get arround cors we need to use
 * the server variable to get around cors. io
 * will handle our input and output.
 */
let io = require('socket.io')(server, {
	cors: {
		origin: "https://lachlangmurphy.com",
		methods: ["GET", "POST"]
	}
});

console.log("Server running " + path + " on port: " + port);

// If the server ever goes down we need to retrieve the old accounts
let accounts = new Map();
fs.readFile('data.txt', 'utf8', (err, data) => {
	if (err) {
		console.error("Exception while finding file: " + err);
		return;
	}
	
	let acts = data.toString().split("\n");
	try {
		for (const a of acts)
			accounts.set(a.email, new account(a));
		console.log("Accounts refreshed.");
	} catch (e) {
		console.log("Could not refresh accounts: " + e);
	}
});

class account {
	constructor(data) {
		this.firstName = data.firstName;
		this.lastName = data.lastName;
		this.email = data.email;
		this.password = data.password;


		// Don't need this for now
		// Assigns the account a random ID not already in use
		// do {
		// 	let id = random(0,1000);
		// 	let repeat = false;
		// 	for (const [key,value] of accounts) {
		// 		if (id === value.id) {
		// 			repeat = true;
		// 		}
		// 	}
		// 	if (!repeat) {
		// 		this.id = id;
		// 		break;
		// 	}
		// } while (true);
	}
}
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
let currentConnections = new Map();
io.sockets.on('connection', socket => {
	const date = new Date();
	console.log("Client Connect: " + socket.id + " "
		+date.getFullYear()+"/"
		+months[date.getMonth()]+"/"
		+date.getDate()+", "
		+date.getHours()+":"
		+date.getMinutes()+":"
		+date.getSeconds());

	currentConnections.set(socket.id, socket);

	// When someone signs in
	socket.on('signin', data => {
		if (accounts.has(data.email)) {
			if (accounts.get(data.email).password === data.password) {
				io.to(socket.id).emit('signinSuccessful');
			} else {
				io.to(socket.id).emit('passwordFail');
			}
		} else {
			io.to(socket.id).emit('emailFail');
		}
	});

	// When someone signs up
	socket.on('signup', data => {
		if (!accounts.has(data.email)) {
			accounts.set(data.email, new account(data));
		} else {
			io.to(socket.id).emit('signupFail');
		}

		fs.writeFile('data.txt',JSON.stringify(data), (e) => {
			if (e) {
				return console.log(e);
			}
			console.log("File saved");
		});
	});

	// When the browser requests the current user
	socket.on('getUserData', email => {
		io.to(socket.id).emit('userData', accounts.get(email));
		console.log("Package sent to: "+socket.id);
	});

	socket.on('disconnect', socket => {
		for (let i = 0; i < currentConnections.length-1; i++) {
			if (!currentConnections[i].connected) {
				console.log("Client Disconnect: " + currentConnections[i]);
				currentConnections.splice(i, 1);
			}
		}
	});
});