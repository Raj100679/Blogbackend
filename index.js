const express = require('express');
const cors = require('cors');
const User = require('./models/User');
const Post = require('./models/Post');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express()
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMid = multer({dest: 'uploads/'});
const fs = require('fs');
const PORT=process.env.PORT || 4000

const salt = bcrypt.genSaltSync(10);
const secret = 'hadsbiukbdjhekhiua';


app.use(cors({credentials:true,origin:'http://localhost:3000'}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect(`${DATABASE}/?retryWrites=true&w=majority`);

app.post('/register', async (req,res) => {
    const {username,email,password} = req.body;
    try{
        const UserDoc = await User.create({
            username,
            email, 
            password:bcrypt.hashSync(password,salt),
        });
        res.json(UserDoc);
    }
    catch(e){
        console.log(e);
        res.status(400).json(e);
    }   
});

app.post('/login', async (req,res) => {
    const {username, password} = req.body;
    const UserDoc = await User.findOne({username});
    const passok = bcrypt.compareSync(password, UserDoc.password);
    if(passok){
        //logged in
       jwt.sign({username, id:UserDoc.id}, secret, {}, (err, token)=>{
        if(err) throw err;
        res.cookie('token', token).json({
            id: UserDoc.id,
            username,
        });
       });
    }else{
        res.status(400).json('Wrong crendential');
    }
 });

app.get('/profile', (req, res)=>{
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, (err,info)=>{
        if(err) throw err;
        res.json(info);
    })
    // res.json(req.cookies);
})

app.post('/logout', (req, res)=>{
    res.cookie('token','').json('ok');
})

app.post('/post', uploadMid.single('file'), async(req,res)=>{
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path+'.'+ext;
    fs.renameSync(path, newPath);

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err,info) => {
        if (err) throw err;
        const {title,summary,content} = req.body;
        const postDoc = await Post.create({
          title,
          summary,
          content,
          cover:newPath,
          author:info.id,
        });
        res.json(postDoc);
      });
    // res.json(req.files);
});

app.put('/post',uploadMid.single('file'), async (req,res) => {
    let newPath = null;
    if (req.file) {
      const {originalname,path} = req.file;
      const parts = originalname.split('.');
      const ext = parts[parts.length - 1];
      newPath = path+'.'+ext;
      fs.renameSync(path, newPath);
    }
  
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err,info) => {
      if (err) throw err;
      const {id,title,summary,content} = req.body;
      const postDoc = await Post.findById(id);
      const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
      if (!isAuthor) {
        return res.status(400).json('you are not the author');
      }
      await postDoc.update({
        title,
        summary,
        content,
        cover: newPath ? newPath : postDoc.cover,
      });
  
      res.json(postDoc);
    });
  
  });
  
  app.get('/post', async (req,res) => {
    res.json(
      await Post.find()
        .populate('author', ['username'])
        .sort({createdAt: -1})
        .limit(20)
    );
  });
  
  app.get('/post/:id', async (req, res) => {
    const {id} = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
  })
  

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });

