const LOGIN_URL="https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_nocis";
const API_URL="https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/nocis_api";
const CERT_URL="https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_certificate_noais2";
const FULL_NORM_URL="https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/noais2_norm/norm.json";

const PDF_URL="https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_noais_pdf";

const loginSection=document.getElementById("loginSection");
const instructionsSection=document.getElementById("instructionsSection");
const loginMsg=document.getElementById("loginMsg");
const emailInput=document.getElementById("email");
const passwordInput=document.getElementById("password");
const loginBtn=document.getElementById("loginBtn");
const startSpatial=document.getElementById("startSpatial");
const startNumerical=document.getElementById("startNumerical");
const startVerbal=document.getElementById("startVerbal");
const startAbstract=document.getElementById("startAbstract");
const startLogical=document.getElementById("startLogical");

let currentEmail="";
let passwordStage=false;
let loginInProgress=false;

const QUIZ_URLS={
spatial:"quiz_s.html",
numerical:"quiz_n.html",
verbal:"quiz_v.html",
abstract:"quiz_a.html",
logical:"quiz_l.html"
};

function hideAllQuizButtons(){
startSpatial?.classList.add("hidden");
startNumerical?.classList.add("hidden");
startVerbal?.classList.add("hidden");
startAbstract?.classList.add("hidden");
startLogical?.classList.add("hidden");
}

function showAllowedQuizButtons(p){
hideAllQuizButtons();
if(!p)return;
if(p.allowed_spatial)startSpatial?.classList.remove("hidden");
if(p.allowed_numerical)startNumerical?.classList.remove("hidden");
if(p.allowed_verbal)startVerbal?.classList.remove("hidden");
if(p.allowed_abstract)startAbstract?.classList.remove("hidden");
if(p.allowed_logical)startLogical?.classList.remove("hidden");
}

function showPasswordField(){
passwordStage=true;
passwordInput.value="";
passwordInput.classList.remove("hidden");
passwordInput.removeAttribute("readonly");
requestAnimationFrame(()=>{
passwordInput.value="";
passwordInput.focus();
setTimeout(()=>passwordInput.value="",100);
});
}

function getPassword(){
return sessionStorage.getItem("password")||passwordInput.value.trim();
}

async function openPdf(pdf){
const password=getPassword();
if(!currentEmail||!password){
alert("Please log in again.");
return;
}

try{

const res=await fetch(PDF_URL,{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
email:currentEmail,
password,
pdf
})
});

if(!res.ok){
  const text = await res.text();
  console.log("PDF ERROR:", res.status, text);
  alert(text);
  return;
}
const blob=await res.blob();

const url=URL.createObjectURL(blob);

window.open(url,"_blank","noopener");

setTimeout(()=>URL.revokeObjectURL(url),60000);

}catch(err){
console.error(err);
alert("Network error.");
}
}

function finishLogin(payload,password){
const permissions=payload.permissions||{};

localStorage.setItem("email",currentEmail);
localStorage.setItem("noais_email",currentEmail);
localStorage.setItem("nocis_logged_in","true");
localStorage.setItem("nocis_permissions",JSON.stringify(permissions));
sessionStorage.setItem("password",password);

window.loggedEmail=currentEmail;
passwordInput.value="";

loginSection.classList.add("hidden");
instructionsSection.classList.remove("hidden");

showAllowedQuizButtons(permissions);
loadLeaderboardChoice();
loadRawScore();
}
function restoreLogin(){
const savedEmail=localStorage.getItem("email");
const savedPassword=sessionStorage.getItem("password");
const loggedIn=localStorage.getItem("nocis_logged_in")==="true";

passwordInput.value="";

if(!savedEmail||!savedPassword||!loggedIn){
localStorage.removeItem("email");
localStorage.removeItem("noais_email");
localStorage.removeItem("nocis_logged_in");
localStorage.removeItem("nocis_permissions");

currentEmail="";
passwordStage=false;
loginInProgress=false;

emailInput.value="";
passwordInput.value="";
passwordInput.classList.add("hidden");
passwordInput.setAttribute("readonly","readonly");

loginBtn.innerText="Login";
loginBtn.disabled=false;
loginMsg.innerText="";

loginSection.classList.remove("hidden");
instructionsSection.classList.add("hidden");
hideAllQuizButtons();
return;
}

currentEmail=savedEmail;
window.loggedEmail=savedEmail;
emailInput.value=savedEmail;

let permissions={};

try{
permissions=JSON.parse(localStorage.getItem("nocis_permissions")||"{}");
}catch{
permissions={};
}

loginSection.classList.add("hidden");
instructionsSection.classList.remove("hidden");
showAllowedQuizButtons(permissions);
loadLeaderboardChoice();
loadRawScore();
}

function resetLoginPage(){
currentEmail="";
window.loggedEmail="";
passwordStage=false;
loginInProgress=false;
localStorage.removeItem("email");
localStorage.removeItem("noais_email");
localStorage.removeItem("nocis_logged_in");
localStorage.removeItem("nocis_permissions");
sessionStorage.removeItem("password");
emailInput.value="";
passwordInput.value="";
passwordInput.classList.add("hidden");
passwordInput.setAttribute("readonly","readonly");
loginBtn.innerText="Login";
loginBtn.disabled=false;
loginMsg.innerText="";
loginSection.classList.remove("hidden");
instructionsSection.classList.add("hidden");
hideAllQuizButtons();
}

async function login(){
if(loginInProgress)return;

currentEmail=emailInput.value.trim();
const password=passwordStage?passwordInput.value.trim():"";

if(!currentEmail){
loginMsg.innerText="Enter email.";
emailInput.focus();
return;
}

if(passwordStage&&!password){
loginMsg.innerText="Enter your password.";
passwordInput.focus();
return;
}

loginInProgress=true;
loginBtn.disabled=true;
loginMsg.innerText="Checking…";

try{
const res=await fetch(LOGIN_URL,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
email:currentEmail,
password:passwordStage?password:null
})
});

const payload=await res.json().catch(()=>({}));

if(!res.ok||payload.error){
loginMsg.innerText=payload.error||"Login failed.";
loginBtn.disabled=false;
loginInProgress=false;
return;
}

if(payload.need_password){
showPasswordField();
loginMsg.innerText=payload.emailed
?"A password was sent to your email. Enter it below."
:"Enter your existing password.";
loginBtn.innerText="Continue";
loginBtn.disabled=false;
loginInProgress=false;
return;
}

if(payload.ok){
finishLogin(payload,password);
loginInProgress=false;
return;
}

loginMsg.innerText="Unexpected login response.";
loginBtn.disabled=false;
loginInProgress=false;

}catch(err){
console.error(err);
loginMsg.innerText="Network error.";
loginBtn.disabled=false;
loginInProgress=false;
}
}

async function loadRawScore(){
const rawScoreEl=document.getElementById("rawScore");
const iqScoreBox=document.getElementById("iqScoreBox");
const iqScoreEl=document.getElementById("iqScore");
const password=getPassword();

if(!rawScoreEl||!currentEmail||!password)return;

try{
const res=await fetch(API_URL,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
action:"get_user",
email:currentEmail,
password
})
});

if(!res.ok)return;

const payload=await res.json().catch(()=>({}));
const user=payload.user||{};
const rawScore=Number(user.score||0);

rawScoreEl.innerText=rawScore;

if(!user.end){
iqScoreBox?.classList.add("hidden");
return;
}

const normRes=await fetch(FULL_NORM_URL);
if(!normRes.ok)return;

const norm=await normRes.json();
let iq=norm[String(rawScore)]??norm[rawScore]??"N/A";

if(iq!=="N/A"){
iq=Math.round(Number(iq));
if(rawScore===0)iq+=" or lower";
}

iqScoreEl.innerText=iq;
iqScoreBox?.classList.remove("hidden");

}catch(err){
console.error(err);
}
}

function getLoggedEmail(){
return window.loggedEmail||localStorage.getItem("noais_email")||localStorage.getItem("email")||emailInput.value.trim();
}

async function generateCertificate(){
const btn=document.getElementById("generateCertBtn");
const status=document.getElementById("certStatus");
const email=getLoggedEmail();

if(!btn||!status)return;

if(!email){
status.style.color="crimson";
status.textContent="Missing email. Please log in again.";
return;
}

btn.disabled=true;
btn.textContent="Generating...";
status.style.color="#333";
status.textContent="Generating certificate...";

try{
const res=await fetch(CERT_URL,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({email})
});

const body=await res.json().catch(()=>({}));

if(!res.ok||body.error){
status.style.color="crimson";
status.textContent=body.error||"Could not generate certificate.";
btn.disabled=false;
btn.textContent="Generate Certificate";
return;
}

status.style.color="#2a7a2a";
status.innerHTML=`Certificate generated successfully.<br><a href="${body.url}" target="_blank" rel="noopener noreferrer">Open certificate PDF</a>`;
btn.textContent="Certificate Generated";

}catch(err){
console.error(err);
status.style.color="crimson";
status.textContent="Network error while generating certificate.";
btn.disabled=false;
btn.textContent="Generate Certificate";
}
}

async function loadLeaderboardChoice(){
const checkbox=document.getElementById("leaderboardCheckbox");
const password=getPassword();

if(!checkbox||!currentEmail||!password)return;

try{
const res=await fetch(API_URL,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
action:"update_user",
email:currentEmail,
password,
subtest:"spatial"
})
});

if(!res.ok)return;

const payload=await res.json().catch(()=>({}));
checkbox.checked=payload?.user?.leaderboard===true;

}catch(err){
console.error(err);
}
}

loginBtn.addEventListener("click",login);

passwordInput.addEventListener("keydown",e=>{
if(e.key==="Enter"){
e.preventDefault();
login();
}
});

emailInput.addEventListener("keydown",e=>{
if(e.key==="Enter"){
e.preventDefault();
login();
}
});

emailInput.addEventListener("input",()=>{
if(!passwordStage)return;
passwordStage=false;
passwordInput.value="";
passwordInput.classList.add("hidden");
passwordInput.setAttribute("readonly","readonly");
loginBtn.innerText="Login";
loginMsg.innerText="";
});

document.getElementById("generateCertBtn")?.addEventListener("click",generateCertificate);

document.addEventListener("change",async e=>{
if(e.target?.id!=="leaderboardCheckbox")return;

const checkbox=e.target;
const status=document.getElementById("leaderboardStatus");
const checked=checkbox.checked;
const password=getPassword();

if(!password){
checkbox.checked=!checked;
if(status)status.innerText="Login information is missing.";
return;
}

checkbox.disabled=true;
if(status)status.innerText="Saving…";

try{
const res=await fetch(API_URL,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
action:"update_user",
email:currentEmail,
password,
subtest:"spatial",
update:{leaderboard:checked}
})
});

if(!res.ok)checkbox.checked=!checked;
if(status)status.innerText=res.ok?"Saved.":"Could not save.";

}catch(err){
console.error(err);
checkbox.checked=!checked;
if(status)status.innerText="Could not save.";
}finally{
checkbox.disabled=false;
}
});

document.addEventListener("click",e=>{
const btn=e.target.closest(".tab-btn");
if(!btn)return;

const targetId=btn.dataset.tab;

document.querySelectorAll(".tab-btn").forEach(b=>{
b.classList.toggle("active",b===btn);
});

document.querySelectorAll(".tab-panel").forEach(panel=>{
panel.classList.toggle("active",panel.id===targetId);
});
});

startSpatial.onclick=()=>location.href=QUIZ_URLS.spatial;
startNumerical.onclick=()=>location.href=QUIZ_URLS.numerical;
startVerbal.onclick=()=>location.href=QUIZ_URLS.verbal;
startAbstract.onclick=()=>location.href=QUIZ_URLS.abstract;
startLogical.onclick=()=>location.href=QUIZ_URLS.logical;

document.getElementById("pdfSpatial")?.addEventListener("click",e=>{
e.preventDefault();
openPdf("spatial");
});

document.getElementById("pdfNumerical")?.addEventListener("click",e=>{
e.preventDefault();
openPdf("numerical");
});

document.getElementById("pdfVerbal")?.addEventListener("click",e=>{
e.preventDefault();
openPdf("verbal");
});

document.getElementById("pdfAbstract")?.addEventListener("click",e=>{
e.preventDefault();
openPdf("abstract");
});

document.getElementById("pdfLogical")?.addEventListener("click",e=>{
e.preventDefault();
openPdf("logical");
});

passwordInput.value="";
restoreLogin();