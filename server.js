function random(min, max) {
	return Math.round(Math.random() * (max - min) + min);
}

function updateData() {
	let acts = [];
	for (const [key,data] of accounts) {
		acts.push(JSON.stringify(data));
	}
	let data = acts.join('\n');
	fs.writeFile('data.txt',data, (e) => {
		if (e) {
			return console.log(e);
		}
	});
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
 * the server variable. io will handle our input
 * and output.
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
		for (let i = 0; i < acts.length; i++) {
			let a = JSON.parse(acts[i]);
			accounts.set(a.email, new account(a));
		}
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
		this.loginKey = "";
		if (data.snakeHigh != null)
			this.snakeHigh = data.snakeHigh;
		else
			this.snakeHigh = 0;
		if (data.agarioHigh != null)
			this.agarioHigh = data.agarioHigh;
		else
			this.agarioHigh = 0;
		if (data.minesweeperHigh != null)
			this.minesweeperHigh = data.minesweeperHigh;
		else
			this.minesweeperHigh = 0;
		if (data.tetrisHigh != null)
			this.tetrisHigh = data.tetrisHigh;
		else
			this.tetrisHigh = 0;
		if (data.asteroidsHigh != null)
			this.asteroidsHigh = data.asteroidsHigh;
		else
			this.asteroidsHigh = 0;
		if (data.galagaHigh != null)
			this.galagaHigh = data.galagaHigh;
		else
			this.galagaHigh = 0;


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

	resetKey() {
		this.loginKey = "";
	}

	assignKey() {
		this.loginKey = random(0,1000);
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
				// In order to keep the user between domains we need
				// to create a unique key so the browser can identify
				// the user and embed it in the url
				accounts.get(data.email).loginKey = random(0,1000);
				io.to(socket.id).emit('signinSuccessful', accounts.get(data.email).loginKey);
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
			return;
		}

		updateData();
	});

	// When the browser requests the current user
	socket.on('getUserData', email => {
		io.to(socket.id).emit('userData', accounts.get(email));
	});

	// When the browser requests key match
	socket.on('getKeyMatch', key => {
		let k = Array.from(accounts.keys());
		for (let i = 0; i < k.length; i++) {
			let act = accounts.get(k[i]);
			if (act.loginKey == key) {
				io.to(socket.id).emit('keyMatch', act);
				act.resetKey();
				return;
			}
		}
		
		io.to(socket.id).emit('noKeyMatch');
	});

	socket.on('requestKey', email => {
		accounts.get(email).assignKey();
		io.to(socket.id).emit('sendKey', accounts.get(email).loginKey);
	});

	socket.on('changeAccount', data => {
		let oldAct = accounts.get(data.oldEmail);
		accounts.set(data.email, oldAct);
		for (const key in data) {
			if (data[key] != "") {
				accounts.get(data.email)[key] = data[key];
			}
		}
		accounts.delete(data.oldEmail);
		io.to(socket.id).emit('changeAccountSuccess', accounts.get(data.email));

		updateData();
	});

	// Getting/Setting high scores
	// If you want to get the high scores just
	// ask for 'getUserData'
	socket.on('setHigh', ([user,type,value]) => {
		console.log(user,type,value);
		if (!accounts.get(user).hasOwnProperty(type)) {
			io.to(socket.id).emit('failedSetHigh');
			return;
		}

		accounts.get(user)[type] = value;
		console.log(accounts.get(user));
		updateData();
	});

	// When the client disconnects
	socket.on('disconnect', socket => {
		for (let i = 0; i < currentConnections.length; i++) {
			if (!currentConnections[i].connected) {
				console.log("Client Disconnect: " + currentConnections[i]);
				currentConnections.splice(i, 1);
			}
		}
	});
});