const express = require("express")
const app = express()

const session = require('express-session')
const fileStore = require('session-file-store')(session)
const bodyParser = require('body-parser')

const { MongoClient } = require("mongodb")
const Client = require("mongodb").MongoClient
let db

const { WebSocketServer } = require("ws")

Client.connect(process.env['MONGO_DB_CONNECTION_URL'], (err, database) => {
  if (err) return console.log(error)
  db = database.db('CoalDB').collection('users')
  const server = app.listen(process.env.PORT || 80, () => {
    console.log("Server Started")
  })
})

app.set('view engine', 'ejs')
app.use(
  session({
    secret: process.env['SECRET'],
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 24 * 6 * 60 * 10000,
    },
    store: new fileStore(),
  }),
  bodyParser.urlencoded({
    extended: true
  }),
  express.static(__dirname + '/public')
)

app.get('/', async (req, res) => {
  if (req.session.logged_in != true)
    return res.redirect('/login')

  const cur = db.find({ email: req.session.email, password: req.session.password }, { email: 1, username: 1, password: 1, _id: 1, rooms: 1 })
  arr = await cur.toArray()

  return res.render('app', { 'username': req.session.username, 'email': req.session.email, 'id': req.session._id, 'rooms': arr[0].rooms, 'room': 'NOUL-ERR' })
})

app.post('/add-channel', async (req, res) => {
  var channel_id = Math.round(Math.random() * (99999999999999) + 1)
  var channel_name = req.body.channel

  const cur = db.find({ email: req.session.email, password: req.session.password }, { email: 1, username: 1, password: 1, _id: 1, rooms: 1 })
  arr = await cur.toArray()

  arr[0].rooms.push([channel_id, channel_name])

  db.updateOne({ email: req.session.email, password: req.session.password }, { $set: { rooms: arr[0].rooms } })

  return res.redirect('/')
})

app.post('/invite-user', async (req, res) => {
  var user_email = req.body.email
  var channel_id = req.body.channel_id
  var channel_name = req.body.channel_name

  console.log(user_email, channel_id, channel_name)

  const cur = db.find({ email: user_email }, { email: 1, username: 1, password: 1, _id: 1, rooms: 1 })
  arr = await cur.toArray()

  arr[0].rooms.push([channel_id, channel_name])

  db.updateOne({ email: user_email }, { $set: { rooms: arr[0].rooms } })
  return res.redirect('/')
})

app.get('/rooms/:room', async (req, res) => {
  if (req.session.logged_in != true)
    return res.redirect('/login')

  if (req.params.room == undefined) {
    return res.redirect('/')
  }

  const cur = db.find({ email: req.session.email, password: req.session.password }, { email: 1, username: 1, password: 1, _id: 1, rooms: 1 })
  arr = await cur.toArray()

  var flag = false
  var room

  for (var i = 0; i < arr[0].rooms.length; i++) {
    if (arr[0].rooms[i][0] == Number(req.params.room)) {
      flag = true
      room = arr[0].rooms[i]
    }
  }

  if (flag)
    return res.render('app', { 'username': req.session.username, 'email': req.session.email, 'id': req.session._id, 'rooms': arr[0].rooms, 'room': room })

  return res.redirect('/')
})

app.get('/register', (req, res) => {
  if (req.session.logged_in == true)
    return res.write("<script>alert('You are already logged in'); location.href='/'</script>")

  return res.render('register')
})

app.post('/register', async (req, res) => {
  if (req.session.logged_in == true)
    return res.write("<script>alert('You are already logged in'); location.href='/'</script>")

  var name = req.body.name
  var e_mail = req.body.username
  var pw = req.body.password
  var flag = true

  const cur = db.find({ email: e_mail }, { item: 1, email: 1, username: 1, password: 1, rooms: 1, _id: 1 })
  arr = await cur.toArray();

  for (const doc of arr) {
    if (doc.email == e_mail) {
      flag = false
    }
  }

  if (flag == false)
    return res.write("<script>alert('There is an account that the has same email'); location.href='/register'</script>")

  db.insertOne({ username: name, email: e_mail, password: pw, rooms: [] })

  return res.redirect('/')
})

app.get('/login', (req, res) => {
  if (req.session.logged_in == true)
    return res.write("<script>alert('You are already logged in'); location.href='/'</script>")

  return res.render('login')
})

app.post('/login', async (req, res) => {
  if (req.session.logged_in == true)
    return res.write("<script>alert('You are already logged in'); location.href='/'</script>")

  var e_mail = req.body.username
  var pw = req.body.password

  const cur = db.find({ email: e_mail, password: pw }, { item: 1, email: 1, username: 1, password: 1, _id: 1, rooms: 1 })
  arr = await cur.toArray()

  try {
    req.session.logged_in = true
    req.session.email = e_mail
    req.session.password = pw
    req.session.username = arr[0].username
    req.session.rooms = arr[0].rooms
    req.session._id = arr[0]._id
  } catch {
    return res.write("<script>alert('Email or password is wrong.'); location.href='/login'</script>")
  }

  req.session.save(() => {
    return res.redirect('/')
  })
})

app.get('/logout', (req, res) => {
  req.session.destroy()
  return res.redirect('/')
})

/*app.get('/deleteallaccountsasdlfjaefasjifjoijfijsdfjsriajfoiashughuaherufhiasjidfhoseogfhasuhfisahdihgasjdfihasdifjaisdhfashgduashugahusifou', (req, res) => {
  db.deleteOne({})
})*/

// Socket

const wss = new WebSocketServer({ port: 8001 })

wss.on("connection", (ws, request) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  /*ws.on("close", () => {
    wss.clients.forEach((client) => {
      client.send(`유저 한명이 떠났습니다. 현재 유저 ${wss.clients.size} 명`)
      client.send('🔤🆗⏹️⏺️#️⃣*️⃣')
    });
  });*/

  ws.on("message", data => {
    wss.clients.forEach(client => {
      client.send(data.toString())
    })
  })

  /*wss.clients.forEach((client => {
    client.send(`새로운 유저가 접속했습니다. 현재 유저 ${wss.clients.size} 명`)
  }))*/
})

