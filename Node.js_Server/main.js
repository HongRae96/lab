const express = require('express');
const path = require('path');
const app = express();
var http = require('http');
var server = http.createServer(app);
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const port = new SerialPort('COM3')
const {crc16xmodem} = require('crc')

var io = require('socket.io')(server); //socket io 
var bodyParser = require('body-parser');
var mysql = require('mysql');

var conn = mysql.createConnection({ //'harbor' database 연결
    host    :   'localhost',
    user    :   'root',
    password:   'root',
    database:   'harbor',
});
//socket.setMaxListeners(20);
io.setMaxListeners(20);
var del = conn._protocol._delegateError;                      //pending 현상 제거
conn._protocol._delegateError = function(err, sequence){
  if (err.fatal) {
    console.trace('fatal error: ' + err.message);
  }
  return del.call(this, err, sequence);
};

app.use(bodyParser.urlencoded({ extended: false }));        

app.use(express.static(path.join(__dirname, 'html')));  //html 폴더 사용
app.set('view engine', 'ejs');
app.get('/login__user/board', (req, res) => {
  var query = conn.query('select nb,worker,latitude,longitude,hg,fg,hb,DATE_FORMAT(time, "%Y/%m/%d %T") as time from danger',function(err,rows){
      if(err) console.log(err)        // 만약 에러값이 존재한다면 로그에 표시합니다.
      console.log('rows :' +  rows);
      res.render('list', { title:'danger List',rows: rows }); // view 디렉토리에 있는 list 파일로 이동합니다.
      //res.sendFile(path.join(__dirname, 'views', 'list.ejs'));
    });
});
var w;  //위도
var k;  //경도
var hg; //유해가스
var fg; // 가연성가스
var hb; // 심박수
var worker = ['0','2']; // op코드 상태
var crc = '0'; // 전송에 쓰는 crc변수초기상태
var check_crc=0;//받아서 연산하는 crc변수
var r_crc = 0;  //받은 crc값
var r_op = '0'; //받는 opcode
var r_state = 1; //데이터가 들어왔는지?
var s_state= 1;// 보냈는지 확인
var com = '1';

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'about1.html')); //about.html 사용
});

//이밑은 데이터 베이스 html 에 전송
app.get('/login__user', (req, res) => {
  console.log('실행됨1');
      //worker1 table선택
 
  res.sendFile(path.join(__dirname, 'html', 'main.html'));  //page.html 사용
});


//이밑은 로그인

app.post('/login_user', function(req, res){         //app.post('login_user',  form에서 로그인 버튼을 누르면 login_user
 var loginID = req.body.user_id;    
 var loginPassword = req.body.user_pwd;// 경로로 이동할 것이고 login_user 경로가 된다면 app.post를 실행함 뜻
                      // input 의 id,pw를 입력 후에 데이터를 서버로 보내는 과정에서
 var loginsql = 'SELECT * FROM login WHERE id = ?';      // login table 안에 id 비교
var a=1;
var b=1;                                                        
 
 conn.query(loginsql, loginID, function (err, rows, fields) {
        if (err) {
                 console.log('err :' + err);
        } else {
                if (rows[0]!=undefined) {
                  if(loginPassword == rows[0].password){
                    a = rows[0].id;
                    b= rows[0].password;
                    console.log(a);
                    console.log(b);
                    console.log('login 성공');
                   
                    res.redirect('/login__user');
                  }
                  else{
                    console.log('패스워드가 일치하지 않음');
                  }
                } else {
                        console.log(rows[0]);
                        console.log('해당 유저가 없습니다');
                }
        }
        })
      });     

var realworker = 1;
    
server.listen(3000, () => {
  console.log('Express App on port 3000!');
});
    
var alldata='0';
var bitsarray = [1,2,3,4,5,6,7];
var array = [1,1,1,1,1,1,1];
var array2 = [1,1,1,1,1,1,1];
var bmw = [1,1,1,1,1,1,1];  //[1],[2]를 전시장 gps로 바꾸고
var i=0;
var x = 0;
const parser = port.pipe(new Readline({ delimiter: '*' }))
parser.on('data', function(data){
      r_state = 0;
      bitsarray[i] = data;
    
    i++;
    if(i == 7){//파싱했을때 8개로 들어오면
      i=0;
      array = bitsarray;
      if(array2 == array)
      {
        console.log("대기")
      }
      else{
        array2 = array;
      }
    }
    x++;
    if(x==7)    //파싱했을때 8개로 들어오면
    {
      x=0;
      console.log(array2)
      
    r_crc = array[6];//받은 crc값을 r_crc에 넣음
    com = array2[0];
    r_state = 0;
    alldata=array2[1]+array2[2]+array2[3]+array2[4]+array2[5];
    console.log("alldata = "+alldata);
      check_crc = crc16xmodem(alldata).toString(16);//crc-xmodem연산
      check_crc = check_crc.toUpperCase();
      console.log("crc = "+check_crc)
     if(check_crc==r_crc)//내가 구한 crc랑 같을때
      {
        r_op=String(array[0]);//참일때 r_op에 opcode저장
        crc = '1';//참일때 전송에 전달
        var loginsql1 = 'SELECT * FROM worker1';
        var loginsql2 = 'SELECT * FROM danger';//위험 테이블
        var datasql2 = 'INSERT INTO danger (worker,latitude , longitude ,hg ,fg ,hb) VALUES (?,?,?,?,?,?)';
        var GPSw = array2[1];
        var GPSk = array2[2];
        var HG = array2[3];
        var FG = array2[4];
        var HB = array2[5];

        var datasql = 'UPDATE worker1 SET latitude=? , longitude=? ,hg=? ,fg=? ,hb=? WHERE nb = 1';;
        if ((bitsarray[2] == null)||(bitsarray[3] == null)||(bitsarray[4] == null)){
          console.log("대기")
        }
        else{
          if((array2[3]>400)||(array2[4]>500)||(array2[5]>180))
          {
            var send = setTimeout(function(){
            conn.query(loginsql2, function (err, rows, fields) {
              if (err) {
                console.log('err :' + err);
                } else {
                     conn.query(datasql2, [1,GPSw,GPSk,HG,FG,HB], function(err,response){
                   if(err){
    
                         console.log(err);
                 } 
                  else{
                        console.log("위험 데이터 저장");
                        r_state = 0;
                    }
                });
                  }    
                 });
                      
                },5000);
          }
          if(array2[0]==1)
          {
            console.log("시작준비중");
          }
          else if(array2[0]==2)
          {
              conn.query(loginsql1, function (err, rows, fields) {
                if (err) {
                  console.log('err :' + err);
                  } else {
                       conn.query(datasql, [GPSw,GPSk,HG,FG,HB], function(err,response){
                     if(err){
      
                           console.log(err);
                   } 
                    else{
                          console.log("데이터 저장 완료 !");
                      }
                  });
                    }    
                   });
            
           
          }
          else
          {
            crc = '2';//거짓일때 전송에 전달
            r_op='3'; 
          }
              
         }
      }
      else//내가 구한 crc랑 다를 때
      {
        crc = '2';//거짓일때 전송에 전달
        r_op='4';
      }
    
     
    }//여기까지
});
// 이 밑은 전송하는 부분

var send = setInterval(function(){
  var sql= 'SELECT *FROM worker1 ORDER BY nb DESC LIMIT 1';

    conn.query(sql, function (err, rows, fields) {
      if (err)
      {
          console.log('err :' + err);
       }
      else
      { 
             w = rows[0].latitude;
             k = rows[0].longitude;
             hg = rows[0].hg;
             fg = rows[0].fg;
             hb = rows[0].hb;

              io.once('connect',function(socket){                   //socket.io으로 보냄 객체
              console.log('클라이언트 접속');                    //객체 작업자 
              socket.on('disconnect',function(){
                io.emit('disconnect');
              });
              console.log(com+'이기범한테 전송'); 
               socket.emit('data1',{w,k,hg,fg,hb,com});  //이걸로보냄
               console.log('웹에 전송'); 
               socket.once('data2',function(s){
                console.log("스테이트 : "+s.state);
                console.log("스테이트2 : "+s.state2);

                worker[0]=String(s.state);
                worker[1]=String(s.state2);
                console.log("worker0 = "+worker[0]);
                console.log("worker1 = "+worker[1]);
               });            
              });
            io.off
       }        
 });
},1000);// 1초마다 보냄


var array3=[111,333];
port.once('open', function() {      
  var send = setInterval(function(){
        console.log('기범이한테 받은 작업자정보 : '+worker[0]);
        if(r_op=='0')
        {

        }
        else
        {
            if(crc=='0')    //받기전일때
            {
                console.log("전송 대기")
            }
            else if(crc=='1')   //참일때
            {
                if(r_op=='1'){  //시작점검
                  setTimeout(function() {
                    port.write('1', function(err) {
                      if (err) {
                      return console.log('Error on write: ', err.message);
                        }
                       else{
                        console.log('통신 연결중');
                        r_state = 1;//잘 보냄
                        s_state= 1;// 보냈는지
                        array3[0]='1';
                        }
                       r_op = 0;
                    });
                  }, 1000);
                
                }
                else if(r_op == '2')//세환이가 잘 받았을때
                {
                    s_op = 2;   //보내는op
                    if((worker[0] == '1')&&(worker[1] == '0')) //기범이한테받은 데이터가 1일때
                    {
                      setTimeout(function() {
                        console.log('1초딜레이');
                        port.write('2', function(err) {
                          if (err) {
                          return console.log('Error on write: ', err.message);
                          }
                           else{
                           console.log('2보냄 + 안전');//
                           r_state = 1;//잘 보냄
                           s_state= 1;// 보냈는지
                           array3[0]='2';
                          }
                           r_op = 0;
                      });      //초기화
                      }, 1000); 
                        
                    }
                    else if((worker[0]=='2')&&(worker[1] == '0'))//기범이한테 받은 데이터가 2일때
                    {
                      setTimeout(function() {
                        console.log('1초딜레이');
                        port.write('3', function(err) {
                          if (err) {
                          return console.log('Error on write: ', err.message);
                          }
                           else{
                           console.log('3보냄');
                           r_state = 1;//잘 보냄
                           s_state= 1;// 보냈는지
                           array3[0]='3';
                          }
                           r_op = 0;
                      });      //초기화
                      }, 1000);
                        
                    }
                    else if((worker[0]=='0')&&(worker[1] == '0'))//기범이한테 받은 데이터가 2일때
                    {
                      setTimeout(function() {
                        console.log('1초딜레이');
                        port.write('2', function(err) {
                          if (err) {
                          return console.log('Error on write: ', err.message);
                          }
                           else{
                           console.log('2보냄');
                           r_state = 1;//잘 보냄
                           s_state= 1;// 보냈는지
                           array3[0]='2';
                          }
                           r_op = 0;
                      });      //초기화
                      }, 1000);
                        
                    }
                    else if((worker[0] =='3')&&(worker[1] == '0'))//기범이한테 받은 데이터가 3일때
                    {
                      setTimeout(function() {
                        console.log('1초딜레이');
                        port.write('4', function(err) {
                          if (err) {
                              return console.log('Error on write: ', err.message);
                          }
                          else{
                              console.log('4보냄');
                              r_state = 1;//잘 보냄
                              s_state= 1;// 보냈는지
                              array3[0]='4';
                          }
                       r_op = 0;
                      }); 
                      }, 1000);
                        
                    }
                    else if((worker[0] == '4')&&(worker[1] == '0'))    //기범이한테 받은 데이터가 4일때
                    {
                      setTimeout(function() {
                        console.log('1초딜레이');
                        port.write('5', function(err) {
                          if (err) {
                              return console.log('Error on write: ', err.message);
                          }
                          else{
                              console.log('5보냄');
                              r_state = 1;//잘 보냄
                              s_state= 1;// 보냈는지
                              array3[0]='5';
                          }
                          r_op = 0;
                      }); 
                      }, 1000);
                        
                    }
                    else if((worker[0] == '5')&&(worker[1] == '0'))    //기범이한테 받은 데이터가 5일때
                    {
                      setTimeout(function() {
                        port.write('7', function(err) {
                          if (err) {
                              return console.log('Error on write: ', err.message);
                          }
                          else{
                              console.log('7보냄');
                              r_state = 1;//잘 보냄
                              s_state= 1;// 보냈는지
                              array3[0]='7';
                          }
                          r_op = 0;
                      }); 
                      }, 1000);
                        
                    }
                    else if((worker[0] == '6')&&(worker[1] == '0'))    //가스 2개 겹쳤을때
                    {
                      setTimeout(function() {
                        port.write('8', function(err) {
                          if (err) {
                              return console.log('Error on write: ', err.message);
                          }
                          else{
                              console.log('8보냄');
                              r_state = 1;//잘 보냄
                              s_state= 1;// 보냈는지
                              array3[0]='8';
                          }
                          r_op = 0;
                      }); 
                      }, 1000);
                        
                    }
                    else if(worker[1] == '1')    //비상 버튼
                    {
                      setTimeout(function() {
                        port.write('9', function(err) {
                          if (err) {
                              return console.log('Error on write: ', err.message);
                          }
                          else{
                              console.log('9보냄');
                              r_state = 1;//잘 보냄
                              s_state= 1;// 보냈는지
                              array3[0]='9';
                          }
                          r_op = 0;
                      }); 
                      }, 1000);
                        
                    }
                    else
                    {
                        console.log("이기범한테 들어온 데이터 없음")
                        r_op = 0;
                    }
                    
                 }
                else if(r_op == '3')   //세환이가잘 못 받았을때
                 {
                  setTimeout(function() {
                    console.log('1초딜레이');
                    s_op = 2;   //보내는 op
                    port.write(array3[0], function(err)
                    {
                        if (err) {
                            return console.log('Error on write: ', err.message);
                        }
                        else{
                            console.log(array3[0]+'보냄');
                            s_state= 1;// 보냈는지
                            r_state = 1;//잘 보냄
                        }
                        r_op = 0;
                    });
                  }, 1000);
                    
                    
                 }
    
                else//통신 대기
                 {
                     console.log("답장올때까지 대기")
                 }
            }
            else//거짓일때
            {
              setTimeout(function() {
                console.log('1초딜레이');
                port.write('6', function(err) {
                  if (err) {
                      return console.log('Error on write: ', err.message);
                  }
                  else{
                      console.log('6보냄');
                      r_state = 1;//잘 보냄
                      s_state= 1;// 보냈는지
                      array3[0]='6';
                  }
                  
              });
              r_op = 0;
              }, 1000);
                
            }
        }
        
        
    },2000);
    var send = setInterval(function(){
      if(s_state == 0)
      {
        console.log("아직 안보내서 대기")  
      }
      else
      {
       // var send = setTimeout(function(){
        if(r_state == 0)  //보냈는데 들어왔을때
        {
          console.log("보냈는데 데이터가 잘 들어옴")
         /* var send = setInterval(function(){
          port.write('6', function(err) {
            if (err) {
          return console.log('Error on write: ', err.message);
            }
            com = '3';
                console.log('로스생겨서 다시 6 보냄');
              });
            },10000);*/
        }
        else  //보냈는데 안들어왔을때
        {
              port.write('6', function(err) {
                  if (err) {
                return console.log('Error on write: ', err.message);
                  }
                  com = '3';
                      console.log('로스생겨서 다시 6 보냄');
                    });
        }

     // },10000);// 10초마다 확인
      }   
    },10000);// 2초마다 확인
});