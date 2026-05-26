const PASS_MARK            = 40;
const AT_RISK_SCORE        = 40;
const AT_RISK_MIN_SUBJECTS = 3;

const SUPABASE_URL  = "https://eftfrjvgltdcpfnhsyha.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdGZyanZnbHRkY3BmbmhzeWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjc5ODksImV4cCI6MjA5NDc0Mzk4OX0.XWHqgPNXSWfW443hWLX2j7g8prUDQy53VjD602p5DaU";
const FROM_EMAIL    = "results@yourdomain.com";

// ════════════════════════════════════════════════════
// SCHOOL LOGO — change this to your actual logo path
// ════════════════════════════════════════════════════
const SCHOOL_LOGO_URL = "YOUR_LOGO_HERE.png";
// ════════════════════════════════════════════════════

const SCHOOL_CONTACTS = {
  phone:"YOUR PHONE NUMBER HERE", phone2:"YOUR SECOND PHONE NUMBER HERE",
  email:"YOUR EMAIL ADDRESS HERE", whatsapp:"YOUR WHATSAPP NUMBER HERE",
  website:"YOUR WEBSITE HERE"
};

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

function toggleMobileMenu(){document.getElementById('mobile-menu').classList.toggle('open');}
function closeMobileMenu(){document.getElementById('mobile-menu').classList.remove('open');}

function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}
function switchTab(tabId,btn){
  ['upload-tab','manage-tab','fee-tab'].forEach(t=>{const el=document.getElementById(t);if(el)el.classList.add('hidden');});
  document.getElementById(tabId).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
}

const clean=s=>(s||'').toString().trim().toLowerCase();

function getGrade(t){
  if(t>=75)return'A';if(t>=65)return'B';if(t>=55)return'C';
  if(t>=40)return'D';return'E';
}

function getGradeRemark(g){
  return({'A':'Distinction','B':'Very Good','C':'Good','D':'Fair','E':'Poor'})[g]||'';
}

function getAutoRemark(avg){
  if(avg>=75)return"An outstanding Distinction! This student demonstrates exceptional academic ability. Keep soaring higher!";
  if(avg>=65)return"Very Good performance this term. A commendable result that reflects hard work and dedication. Well done!";
  if(avg>=55)return"Good performance this term. With continued focus and effort, even greater heights are achievable.";
  if(avg>=40)return"A fair performance. There is clear potential here — more consistent effort will yield better results next term.";
  return"This result requires urgent attention. We strongly recommend extra coaching and closer parental involvement this holiday.";
}

function mapTraitGrade(v){return({'5':'A — Excellent','4':'B — Good','3':'C — Fair','2':'D — Weak','1':'E — Poor'})[String(v)]||v;}
function getOrdinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
function fmt(d){if(!d)return'—';return new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'});}
function setStatus(id,msg,type='info'){const el=document.getElementById(id);if(!el)return;el.innerHTML=msg?`<div class="alert alert-${type}">${msg}</div>`:'';}
// Standard Competition Ranking: tied students share same position, next rank skips
// e.g. two 1st place → next is 3rd (not 2nd)
function denseRank(myScore,allScores){return allScores.filter(s=>s>myScore).length+1;}

function openAdminModal(){document.getElementById('admin-modal').classList.add('open');}
function closeAdminModal(){document.getElementById('admin-modal').classList.remove('open');}

async function doAdminLogin(){
  const email=document.getElementById('admin-email').value.trim();
  const pass=document.getElementById('admin-pass').value;
  if(!email||!pass){setStatus('admin-status','Please enter email and password','error');return;}
  setStatus('admin-status','⏳ Logging in...','info');
  const{error}=await db.auth.signInWithPassword({email,password:pass});
  if(error){setStatus('admin-status','❌ Invalid email or password.','error');return;}
  closeAdminModal();
  showPage('teacher-page');
  addSubjectRow();
  // Show whichever role buttons match this email
  showRoleButtonsForEmail(email);
}

// ════════════════════════════════════════════════════════════
// ROLE-BASED ACCESS CONTROL — DOUBLE LOCK SYSTEM
// ════════════════════════════════════════════════════════════
//
// HOW IT WORKS:
//   LOCK 1: Staff logs in via the main "Teacher Login" — enters general portal
//   LOCK 2: Inside the portal, they click their role button and log in AGAIN
//           with their specific credentials to unlock restricted features.
//
// ✅ SECURITY: No emails or roles are stored in this file.
//    All role assignments live securely in the Supabase `staff_roles` table.
//    To add/remove staff or change roles, update the table in Supabase only.

// Role configs — icons, titles, descriptions
const ROLE_CONFIG = {
  principal: {
    icon: '🎓',
    title: 'Principal Access',
    sub: 'Restricted to the school principal only',
    btnId: 'principal-role-btn',
  },
  headteacher: {
    icon: '📚',
    title: 'Head Teacher Access',
    sub: 'Restricted to authorised head teachers only',
    btnId: 'headteacher-role-btn',
  },
  cashier: {
    icon: '💰',
    title: 'Cashier Access',
    sub: 'Restricted to the school cashier only',
    btnId: 'cashier-role-btn',
  },
};

// After first login, query Supabase for this staff member's role
// and show only the button that matches — nothing is stored in this file
async function showRoleButtonsForEmail(email){
  const pBtn=document.getElementById('principal-role-btn');
  const cBtn=document.getElementById('cashier-role-btn');
  const hBtn=document.getElementById('headteacher-role-btn');
  // Hide all role buttons by default
  if(pBtn)pBtn.style.display='none';
  if(cBtn)cBtn.style.display='none';
  if(hBtn)hBtn.style.display='none';
  try{
    const{data,error}=await db
      .from('staff_roles')
      .select('role')
      .eq('email',email.trim().toLowerCase())
      .maybeSingle();
    if(error||!data)return; // plain teacher — no special role button shown
    const role=data.role;
    if(role==='principal'  &&pBtn)pBtn.style.display='';
    if(role==='cashier'    &&cBtn)cBtn.style.display='';
    if(role==='headteacher'&&hBtn)hBtn.style.display='';
  }catch(e){console.error('Role lookup failed:',e);}
}

// Open the second-login role modal
let _pendingRole=null;
function openRoleModal(role){
  _pendingRole=role;
  const cfg=ROLE_CONFIG[role];
  document.getElementById('role-modal-icon').textContent=cfg.icon;
  document.getElementById('role-modal-title').textContent=cfg.title;
  document.getElementById('role-modal-sub').textContent=cfg.sub;
  document.getElementById('role-email').value='';
  document.getElementById('role-pass').value='';
  setStatus('role-status','','info');
  const btn=document.getElementById('role-login-btn');
  btn.disabled=false;btn.textContent='🔓 Unlock Access';
  document.getElementById('role-modal').classList.add('open');
}
function closeRoleModal(){document.getElementById('role-modal').classList.remove('open');}

async function doRoleLogin(){
  const email=document.getElementById('role-email').value.trim();
  const pass=document.getElementById('role-pass').value;
  if(!email||!pass){setStatus('role-status','❌ Please enter your email and password.','error');return;}
  const btn=document.getElementById('role-login-btn');
  btn.disabled=true;btn.textContent='⏳ Verifying...';

  // Step 1 — Re-authenticate with Supabase (must be a valid email + password)
  const{error}=await db.auth.signInWithPassword({email,password:pass});
  if(error){
    btn.disabled=false;btn.textContent='🔓 Unlock Access';
    setStatus('role-status','❌ Invalid email or password.','error');return;
  }

  // Step 2 — Verify role in Supabase staff_roles table (NOT hardcoded in this file)
  // RLS ensures each staff member can only read their own row
  let roleData=null,roleErr=null;
  try{
    const res=await db
      .from('staff_roles')
      .select('role')
      .eq('email',email.trim().toLowerCase())
      .maybeSingle();
    roleData=res.data;
    roleErr=res.error;
  }catch(ex){roleErr=ex;}

  if(roleErr||!roleData){
    await db.auth.signOut();
    btn.disabled=false;btn.textContent='🔓 Unlock Access';
    setStatus('role-status','❌ Access denied. No role assigned to this email.','error');return;
  }

  if(roleData.role!==_pendingRole){
    await db.auth.signOut();
    btn.disabled=false;btn.textContent='🔓 Unlock Access';
    setStatus('role-status','❌ Access denied. Your email is not registered for this role.','error');return;
  }

  closeRoleModal();
  applyRoleAccess(_pendingRole);
  _pendingRole=null;
}

// Grant access based on role — called after successful second login
function applyRoleAccess(role){
  const show=id=>{const el=document.getElementById(id);if(el)el.style.display='';};
  const hide=id=>{const el=document.getElementById(id);if(el)el.style.display='none';};

  if(role==='principal'){
    show('deploy-status-bar');
    show('teacher-deploy-btn');
    show('deploy-annual-btn');
    show('manage-tab-btn');
    loadDeployStatus();
    const btn=document.getElementById('principal-role-btn');
    if(btn){
      btn.textContent='✅ Principal — Lock Out';
      btn.disabled=false;
      btn.onclick=()=>lockRole('principal');
      btn.style.background='linear-gradient(135deg,#dc2626,#991b1b)';
    }

  } else if(role==='headteacher'){
    show('manage-tab-btn');
    const btn=document.getElementById('headteacher-role-btn');
    if(btn){
      btn.textContent='✅ Head Teacher — Lock Out';
      btn.disabled=false;
      btn.onclick=()=>lockRole('headteacher');
      btn.style.background='linear-gradient(135deg,#dc2626,#991b1b)';
    }

  } else if(role==='cashier'){
    show('fee-tab-btn');
    const btn=document.getElementById('cashier-role-btn');
    if(btn){
      btn.textContent='✅ Cashier — Lock Out';
      btn.disabled=false;
      btn.onclick=()=>lockRole('cashier');
      btn.style.background='linear-gradient(135deg,#dc2626,#991b1b)';
    }
    setTimeout(()=>{const fb=document.getElementById('fee-tab-btn');if(fb)fb.click();},150);
  }
}

// Lock out a role — hides their features and resets their button
function lockRole(role){
  if(!confirm('Lock out this role? The features will be hidden until you log in again.'))return;
  const hide=id=>{const el=document.getElementById(id);if(el)el.style.display='none';};

  if(role==='principal'){
    hide('deploy-status-bar');
    hide('teacher-deploy-btn');
    hide('deploy-annual-btn');
    hide('manage-tab-btn');
    // Switch back to upload tab
    const uploadBtn=document.getElementById('upload-tab-btn');
    if(uploadBtn) uploadBtn.click();
    const btn=document.getElementById('principal-role-btn');
    if(btn){
      btn.textContent='🎓 Principal Access';
      btn.style.background='linear-gradient(135deg,#7c3aed,#5b21b6)';
      btn.onclick=()=>openRoleModal('principal');
    }

  } else if(role==='headteacher'){
    hide('manage-tab-btn');
    const uploadBtn=document.getElementById('upload-tab-btn');
    if(uploadBtn) uploadBtn.click();
    const btn=document.getElementById('headteacher-role-btn');
    if(btn){
      btn.textContent='📚 Head Teacher Access';
      btn.style.background='linear-gradient(135deg,#0369a1,#075985)';
      btn.onclick=()=>openRoleModal('headteacher');
    }

  } else if(role==='cashier'){
    hide('fee-tab-btn');
    const uploadBtn=document.getElementById('upload-tab-btn');
    if(uploadBtn) uploadBtn.click();
    const btn=document.getElementById('cashier-role-btn');
    if(btn){
      btn.textContent='💰 Cashier Access';
      btn.style.background='linear-gradient(135deg,#15803d,#166534)';
      btn.onclick=()=>openRoleModal('cashier');
    }
  }
}

async function teacherLogout(){await db.auth.signOut();showPage('student-page');}

async function checkSession(){
  const{data}=await db.auth.getSession();
  if(data.session){showPage('teacher-page');addSubjectRow();}
  loadDeployStatus();
}

let currentDeployState=false;

async function loadDeployStatus(){
  try{
    const{data,error}=await db.from('deploy_settings').select('value').eq('key','term_result_deployed').maybeSingle();
    if(error){applyDeployUI(false);return;}
    const deployed=data?(data.value==='true'||data.value===true):false;
    applyDeployUI(deployed);
  }catch(e){applyDeployUI(false);}
}

function applyDeployUI(deployed){
  currentDeployState=deployed;
  const dot=document.getElementById('student-deploy-dot');
  const label=document.getElementById('student-deploy-label');
  const card=document.getElementById('student-search-card');
  const locked=document.getElementById('student-gate-locked');
  if(dot)dot.className='blink-dot '+(deployed?'blink-green':'blink-red');
  if(label){label.textContent=deployed?'✅ Results are now available — you may check below':'🔴 Results have not been released yet';label.style.color=deployed?'#15803d':'#b91c1c';}
  if(card)card.classList.toggle('hidden',!deployed);
  if(locked)locked.classList.toggle('hidden',deployed);
  const tDot=document.getElementById('teacher-deploy-dot');
  const tLabel=document.getElementById('teacher-deploy-label');
  const tBtn=document.getElementById('teacher-deploy-btn');
  if(tDot)tDot.className='blink-dot '+(deployed?'blink-green':'blink-red');
  if(tLabel){tLabel.textContent=deployed?'Results: LIVE':'Results: LOCKED';tLabel.style.color=deployed?'#15803d':'#b91c1c';}
  if(tBtn){if(deployed){tBtn.textContent='🔴 Stop Deployment';tBtn.className='btn-deploy-toggle undeploy';}else{tBtn.textContent='🟢 Deploy Results';tBtn.className='btn-deploy-toggle deploy';}}
}

async function toggleResultDeployment(){
  const btn=document.getElementById('teacher-deploy-btn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Please wait...';}
  const newState=!currentDeployState;
  try{
    const{error}=await db.from('deploy_settings').upsert({key:'term_result_deployed',value:String(newState)},{onConflict:'key'});
    if(error){console.error(error);alert('❌ Could not update deployment status.');if(btn)btn.disabled=false;applyDeployUI(currentDeployState);return;}
    applyDeployUI(newState);
  }catch(e){console.error(e);if(btn)btn.disabled=false;applyDeployUI(currentDeployState);}
  if(btn)btn.disabled=false;
}

function addSubjectRow(){
  const c=document.getElementById('subjects-container');
  const d=document.createElement('div');
  d.className='subject-row';
  d.innerHTML=`
    <div class="field"><input class="subj-name" placeholder="Subject name"/></div>
    <div class="field"><input class="subj-ca1" type="number" min="0" max="100" placeholder="0" oninput="calcTotal(this)"/></div>
    <div class="field"><input class="subj-ca2" type="number" min="0" max="100" placeholder="0" oninput="calcTotal(this)"/></div>
    <div class="field"><input class="subj-ca3" type="number" min="0" max="100" placeholder="0" oninput="calcTotal(this)"/></div>
    <div class="field"><input class="subj-exam" type="number" min="0" max="100" placeholder="0" oninput="calcTotal(this)"/></div>
    <div class="field"><input class="subj-total" readonly style="background:#edf0f8;font-weight:700;color:var(--primary);" placeholder="0"/></div>
    <button class="remove-btn" onclick="this.parentElement.remove();updateRemark()">✕</button>`;
  c.appendChild(d);
}

function calcTotal(inp){
  const row=inp.closest('.subject-row');
  const t=['ca1','ca2','ca3','exam'].map(c=>Number(row.querySelector('.subj-'+c).value)||0).reduce((a,b)=>a+b,0);
  row.querySelector('.subj-total').value=t;
  updateRemark();
}

function updateRemark(){
  const rows=document.querySelectorAll('.subject-row');
  let sum=0,cnt=0;
  rows.forEach(r=>{const t=Number(r.querySelector('.subj-total').value)||0;if(t>0){sum+=t;cnt++;}});
  if(cnt>0)document.getElementById('t-remark').value=getAutoRemark(sum/cnt);
}

async function saveStudent(){
  const name=document.getElementById('t-name').value.trim();
  const id=document.getElementById('t-id').value.trim();
  const term=document.getElementById('t-term').value;
  const session=document.getElementById('t-session').value.trim();
  const cls=document.getElementById('t-class').value.trim();
  if(!name||!id||!term||!session||!cls){setStatus('upload-status','❌ Please fill all required fields marked with *','error');return;}
  const rows=document.querySelectorAll('.subject-row');
  if(!rows.length){setStatus('upload-status','❌ Add at least one subject','error');return;}
  const subjects=[];
  for(const r of rows){
    const sn=r.querySelector('.subj-name').value.trim();
    if(!sn){setStatus('upload-status','❌ All subject names must be filled','error');return;}
    const ca1=Number(r.querySelector('.subj-ca1').value)||0;
    const ca2=Number(r.querySelector('.subj-ca2').value)||0;
    const ca3=Number(r.querySelector('.subj-ca3').value)||0;
    const exam=Number(r.querySelector('.subj-exam').value)||0;
    for(const[label,val]of[['CA1',ca1],['CA2',ca2],['CA3',ca3],['Exam',exam]]){
      if(val<0||val>100){setStatus('upload-status',`❌ ${label} score for "${sn}" must be 0–100`,'error');return;}
    }
    const total=ca1+ca2+ca3+exam;
    subjects.push({subject:sn,ca1,ca2,ca3,exam,total,grade:getGrade(total)});
  }
  const grandTotal=subjects.reduce((a,s)=>a+s.total,0);
  const average=parseFloat((grandTotal/subjects.length).toFixed(2));
  const payload={
    name,student_id:id,
    gender:document.getElementById('t-gender').value,
    age:document.getElementById('t-age').value,
    school_name:document.getElementById('t-school').value.trim(),
    class_name:cls,term,session,
    email:document.getElementById('t-email').value.trim(),
    phone:document.getElementById('t-phone').value.trim(),
    neatness:document.getElementById('tr-neatness').value,
    obedience:document.getElementById('tr-obedience').value,
    punctuality:document.getElementById('tr-punctuality').value,
    attentiveness:document.getElementById('tr-attentiveness').value,
    initiative:document.getElementById('tr-initiative').value,
    self_control:document.getElementById('tr-selfcontrol').value,
    teacher_remark:document.getElementById('t-remark').value.trim(),
    principal_name:document.getElementById('t-principal').value.trim(),
    next_term_begins:document.getElementById('t-next-begin').value||null,
    next_term_ends:document.getElementById('t-next-end').value||null,
    subjects,grand_total:grandTotal,average
  };
  setStatus('upload-status','⏳ Saving student result...','info');
  const{data:existing}=await db.from('students').select('id').eq('student_id',id).eq('term',term).eq('session',session).maybeSingle();
  let error;
  if(existing){({error}=await db.from('students').update(payload).eq('id',existing.id));}
  else{({error}=await db.from('students').insert(payload));}
  if(error){console.error(error);setStatus('upload-status','❌ Could not save result. Please try again.','error');return;}
  setStatus('upload-status',`✅ Result for <strong>${name}</strong> saved successfully!`,'success');
  document.getElementById('subjects-container').innerHTML='';
  addSubjectRow();
  ['t-name','t-id','t-age','t-class','t-session','t-email','t-phone','t-remark'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  document.getElementById('t-gender').value='';
  document.getElementById('t-term').value='';
}

async function fetchStudentResult(){
  const nameRaw=document.getElementById('s-name').value.trim();
  const idRaw=document.getElementById('s-id').value.trim();
  const term=document.getElementById('s-term').value.trim();
  const session=document.getElementById('s-session').value.trim();
  if(!nameRaw||!idRaw||!term||!session){setStatus('s-status','❌ Please fill all fields','error');return;}
  setStatus('s-status','⏳ Searching for your result...','info');
  const normName=nameRaw.replace(/\s+/g,' ').trim();
  const normId=idRaw.replace(/\s+/g,' ').trim();
  let{data:byId,error:err1}=await db.from('students').select('*').ilike('student_id',normId).ilike('term',term).ilike('session',session);
  if(err1){setStatus('s-status','❌ A database error occurred. Please try again.','error');return;}
  let student=null;
  if(byId&&byId.length>0){
    student=byId.find(s=>(s.name||'').replace(/\s+/g,' ').trim().toLowerCase()===normName.toLowerCase());
    if(!student){student=byId.find(s=>{const n=(s.name||'').replace(/\s+/g,' ').trim().toLowerCase();return n.includes(normName.toLowerCase())||normName.toLowerCase().includes(n);});}
  }
  if(!student){
    let{data:byName,error:err2}=await db.from('students').select('*').ilike('name',`%${normName}%`).ilike('term',term).ilike('session',session);
    if(!err2&&byName&&byName.length>0){student=byName.find(s=>(s.student_id||'').replace(/\s+/g,' ').trim().toLowerCase()===normId.toLowerCase())||byName[0];}
  }
  if(!student){setStatus('s-status',`❌ No result found for <strong>${nameRaw}</strong> (ID: ${idRaw}) in <strong>${term}, ${session}</strong>.<br/><small>Check your name, ID, term and session are entered exactly as recorded.</small>`,'error');return;}
  const{data:allPeers}=await db.from('students').select('student_id,grand_total,subjects').ilike('school_name',student.school_name||'').ilike('class_name',student.class_name||'').ilike('term',student.term||'').ilike('session',student.session||'');
  const peers=allPeers||[];
  const classTotal=peers.length||1;
  const allTotals=peers.map(p=>p.grand_total||0);
  const classPos=denseRank(student.grand_total||0,allTotals);
  const subjectsWithPos=(student.subjects||[]).map(s=>{
    const myScore=s.total||0;
    const allSubjectScores=peers.map(p=>{const found=(p.subjects||[]).find(x=>clean(x.subject)===clean(s.subject));return found?(found.total||0):0;});
    return{...s,position:denseRank(myScore,allSubjectScores)};
  });
  setStatus('s-status','','info');
  const blocked=await checkFeeDefaulter(student.student_id,student.name);
  if(blocked)return;
  await renderResultSlip(student,classPos,classTotal,subjectsWithPos);
  showPage('result-slip-page');
}

let appState={student:null,classPos:0,classTotal:0,subjects:[]};

// ════════════════════════════════════════════════════════════
// QR CODE GENERATOR — uses Google Charts API (free, reliable)
// Returns a Promise that resolves to a canvas data URL
// Works for both on-screen display and PDF embedding
// ════════════════════════════════════════════════════════════
function generateQRDataURL(text, sizePx = 200) {
  return new Promise((resolve) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&data=${encodeURIComponent(text)}&color=001B44&bgcolor=ffffff&margin=4`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = sizePx;
        canvas.height = sizePx;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, sizePx, sizePx);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function renderResultSlip(student,classPos,classTotal,subjects){
  appState={student,classPos,classTotal,subjects};
  document.getElementById('slip-logo').src=SCHOOL_LOGO_URL;
  document.getElementById('slip-school').textContent=(student.school_name||'AMBASSADOR INTERNATIONAL SECONDARY SCHOOL').toUpperCase();
  document.getElementById('slip-term-session').textContent=`${(student.term||'').toUpperCase()} RESULT — ${student.session}`;
  document.getElementById('slip-principal').textContent=student.principal_name||'PRINCIPAL';
  document.getElementById('slip-info-grid').innerHTML=[
    ['Student Name',student.name.toUpperCase()],['Student ID',student.student_id],
    ['Gender',(student.gender||'—').toUpperCase()],['Age',student.age||'—'],
    ['Class',student.class_name],['No. in Class',classTotal+' Students'],
    ['Term',student.term],['Session',student.session],
  ].map(([k,v])=>`<div class="slip-info-item"><strong>${k}:</strong><span>${v}</span></div>`).join('');
  document.getElementById('slip-subjects').innerHTML=(subjects||[]).map(s=>`
    <tr>
      <td>${s.subject}</td><td>${s.ca1}</td><td>${s.ca2}</td><td>${s.ca3}</td><td>${s.exam}</td>
      <td><strong>${s.total}</strong></td><td><strong>${s.grade}</strong></td><td>${getGradeRemark(s.grade)}</td><td>${getOrdinal(s.position||1)}</td>
    </tr>`).join('');
  const avg=subjects.length?(student.grand_total/subjects.length).toFixed(1):'0.0';
  document.getElementById('slip-summary').innerHTML=`
    <div class="slip-stat"><div class="val">${student.grand_total}</div><div class="lbl">Grand Total</div></div>
    <div class="slip-stat"><div class="val">${avg}%</div><div class="lbl">Average Score</div></div>
    <div class="slip-stat"><div class="val">${getOrdinal(classPos)}</div><div class="lbl">Class Position</div></div>
    <div class="slip-stat"><div class="val">${classTotal}</div><div class="lbl">Total in Class</div></div>`;
  document.getElementById('slip-traits').innerHTML=[
    ['Neatness',student.neatness],['Obedience',student.obedience],['Punctuality',student.punctuality],
    ['Attentiveness',student.attentiveness],['Initiative',student.initiative],['Self Control',student.self_control]
  ].map(([k,v])=>`<div class="slip-trait-row"><span>${k}</span><span>${mapTraitGrade(v)}</span></div>`).join('');
  document.getElementById('slip-remark').textContent=student.teacher_remark||getAutoRemark(parseFloat(avg));
  document.getElementById('slip-next-term').innerHTML=`
    <div><strong>Next Term Begins</strong>${fmt(student.next_term_begins)}</div>
    <div><strong>Next Term Ends</strong>${fmt(student.next_term_ends)}</div>`;
  // ── ON-SCREEN QR CODE ──
  const qrWrap=document.getElementById('slip-qr-canvas-wrap');
  if(qrWrap&&student.id){
    const verifyUrl=`${window.location.origin}${window.location.pathname}?verify=${student.id}`;
    const qrDataUrl=await generateQRDataURL(verifyUrl,90);
    if(qrDataUrl){
      const img=document.createElement('img');
      img.src=qrDataUrl;
      img.style.cssText='width:52px;height:52px;display:block;';
      img.alt='Scan to verify result';
      qrWrap.innerHTML='';
      qrWrap.appendChild(img);
    }else{
      qrWrap.style.display='none';
      document.getElementById('slip-qr-section').style.display='none';
    }
  }
  autoFitSlip();
}

// ════════════════════════════════════════════
// AUTO-FIT: Scale slip to one A4 page height
// ════════════════════════════════════════════
function autoFitSlip(){
  const slip=document.getElementById('the-slip');
  if(!slip)return;
  slip.style.transform='';
  slip.parentElement.style.height='';
  requestAnimationFrame(()=>{
    const A4_HEIGHT_PX=1122; // 297mm at 96dpi
    const slipH=slip.scrollHeight;
    if(slipH>A4_HEIGHT_PX){
      const scale=A4_HEIGHT_PX/slipH;
      slip.style.transformOrigin='top left';
      slip.style.transform=`scale(${scale})`;
      slip.parentElement.style.height=(slipH*scale)+'px';
    }
  });
}

async function downloadPDF(){
  const{student:s,classPos:curClassPos,classTotal:curClassTotal,subjects}=appState;
  if(!s)return;
  await buildPDF(s,curClassPos,curClassTotal,subjects,1.0);
}

async function buildPDF(s,curClassPos,curClassTotal,subjects,scaleFactor){
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const avg=subjects.length?(s.grand_total/subjects.length).toFixed(1):'0.0';
  const subjectCount=subjects.length;
  // Scale font sizes down if many subjects OR by scaleFactor
  const tblFont=Math.max(5,Math.round((subjectCount>10?7:8)*scaleFactor));
  const tblRowH=Math.max(3.5,Math.round((subjectCount>10?5:6)*scaleFactor));

  // ── HEADER ──
  doc.setFillColor(0,27,68);doc.rect(0,0,210,32,'F');
  // Blue accent stripe under header
  doc.setFillColor(10,132,255);doc.rect(0,30,210,2.5,'F');
  const logoImg=document.getElementById('slip-logo');
  if(logoImg&&logoImg.complete&&logoImg.naturalWidth>0){
    try{const canvas=document.createElement('canvas');canvas.width=logoImg.naturalWidth;canvas.height=logoImg.naturalHeight;canvas.getContext('2d').drawImage(logoImg,0,0);doc.addImage(canvas.toDataURL('image/png'),'PNG',8,4,22,22);}catch(e){}
  }
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(17);
  doc.text((s.school_name||'AMBASSADOR INTERNATIONAL SECONDARY SCHOOL').toUpperCase(),105,13,{align:'center'});
  doc.setFontSize(8);doc.setFont('helvetica','normal');
  doc.text('STUDENT ACADEMIC REPORT',105,21,{align:'center'});
  doc.setFillColor(237,243,251);doc.rect(0,32,210,9,'F');
  doc.setDrawColor(0,27,68);doc.line(0,41,210,41);
  doc.setTextColor(0,27,68);doc.setFont('helvetica','bold');doc.setFontSize(9);
  doc.text(`${(s.term||'').toUpperCase()} RESULT — ${s.session}`,105,38,{align:'center'});

  // ── BIO DATA ──
  const bioRowH=5.5*scaleFactor;
  let y=47;doc.setTextColor(0,27,68);doc.setFontSize(8*scaleFactor);
  const iL=[['Student Name',s.name.toUpperCase()],['Student ID',s.student_id],['Class',s.class_name],['Term',s.term]];
  const iR=[['Gender',(s.gender||'—').toUpperCase()],['Age',s.age||'—'],['Session',s.session],['No. in Class',curClassTotal+' Students']];
  iL.forEach(([k,v],i)=>{doc.setFont('helvetica','bold');doc.text(k+':',14,y+i*bioRowH);doc.setFont('helvetica','normal');doc.text(String(v||''),52,y+i*bioRowH);});
  iR.forEach(([k,v],i)=>{doc.setFont('helvetica','bold');doc.text(k+':',110,y+i*bioRowH);doc.setFont('helvetica','normal');doc.text(String(v||''),147,y+i*bioRowH);});
  y+=22*scaleFactor+4;

  // ── SUBJECTS TABLE ──
  doc.autoTable({
    startY:y,
    head:[['Subject','CA1','CA2','CA3','Exam','Total','Grade','Remark','Position']],
    body:subjects.map(sub=>[sub.subject,sub.ca1,sub.ca2,sub.ca3,sub.exam,sub.total,sub.grade,getGradeRemark(sub.grade),getOrdinal(sub.position||1)]),
    headStyles:{fillColor:[0,27,68],fontSize:tblFont,halign:'center'},
    bodyStyles:{fontSize:tblFont,halign:'center',minCellHeight:tblRowH,cellPadding:1.5*scaleFactor},
    columnStyles:{0:{halign:'left',fontStyle:'bold'},7:{halign:'left'}},
    alternateRowStyles:{fillColor:[237,243,251]},
    margin:{left:14,right:14}
  });
  y=doc.lastAutoTable.finalY+4*scaleFactor;

  // ── SUMMARY STATS ──
  const stats=[['Grand Total',s.grand_total],['Average',avg+'%'],['Class Position',getOrdinal(curClassPos)],['Class Size',curClassTotal]];
  const cW=45.5;
  const sumH=14*scaleFactor;
  stats.forEach(([lbl,val],i)=>{
    const x=14+i*cW;
    doc.setFillColor(237,243,251);doc.roundedRect(x,y,cW-2,sumH,2,2,'F');
    doc.setDrawColor(0,27,68);doc.roundedRect(x,y,cW-2,sumH,2,2,'S');
    doc.setFont('helvetica','bold');doc.setFontSize(11*scaleFactor);doc.setTextColor(0,27,68);
    doc.text(String(val),x+(cW-2)/2,y+sumH*0.5,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(6.5*scaleFactor);doc.setTextColor(74,95,122);
    doc.text(lbl,x+(cW-2)/2,y+sumH*0.85,{align:'center'});
  });
  y+=sumH+5*scaleFactor;

  // ── PSYCHOMOTOR TRAITS (left col) + GRADING KEY (right col) ──
  const traits=[['Neatness',s.neatness],['Obedience',s.obedience],['Punctuality',s.punctuality],['Attentiveness',s.attentiveness],['Initiative',s.initiative],['Self Control',s.self_control]];
  const colW=88; // each column width
  const colGap=6;
  const leftX=14;
  const rightX=leftX+colW+colGap;
  const rowH=5.5*scaleFactor;
  const traitsBodyH=traits.length*rowH;
  const gkRows=[['A','75 & Above','Distinction'],['B','65–74','Very Good'],['C','55–64','Good'],['D','40–54','Fair'],['E','0–39','Poor']];
  const gkRowH=traitsBodyH/gkRows.length; // make grading key rows fill same height as traits

  // Left: Psychomotor header
  doc.setFillColor(0,27,68);doc.rect(leftX,y,colW,6*scaleFactor,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7.5*scaleFactor);
  doc.text('PSYCHOMOTOR & BEHAVIOURAL TRAITS',leftX+colW/2,y+4*scaleFactor,{align:'center'});
  traits.forEach(([k,v],i)=>{
    const ty=y+6*scaleFactor+i*rowH;
    if(i%2===0){doc.setFillColor(237,243,251);doc.rect(leftX,ty,colW,rowH,'F');}
    doc.setTextColor(0,27,68);doc.setFont('helvetica','normal');doc.setFontSize(7.5*scaleFactor);
    doc.text(k,leftX+2,ty+3.8*scaleFactor);doc.setFont('helvetica','bold');doc.text(mapTraitGrade(v),leftX+colW-2,ty+3.8*scaleFactor,{align:'right'});
  });

  // Right: Grading Key header
  doc.setFillColor(0,27,68);doc.rect(rightX,y,colW,6*scaleFactor,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7.5*scaleFactor);
  doc.text('GRADING KEY',rightX+colW/2,y+4*scaleFactor,{align:'center'});
  gkRows.forEach(([grade,range,remark],i)=>{
    const gy=y+6*scaleFactor+i*gkRowH;
    doc.setFillColor(i%2===0?237:248,i%2===0?243:250,i%2===0?251:252);
    doc.rect(rightX,gy,colW,gkRowH,'F');
    doc.setDrawColor(184,200,222);doc.rect(rightX,gy,colW,gkRowH,'S');
    doc.setFont('helvetica','bold');doc.setFontSize(8*scaleFactor);doc.setTextColor(0,27,68);
    doc.text(grade,rightX+10,gy+gkRowH/2+1.5*scaleFactor,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(7*scaleFactor);doc.setTextColor(50,50,50);
    doc.text(range,rightX+colW/2,gy+gkRowH/2+1.5*scaleFactor,{align:'center'});
    doc.setFont('helvetica','italic');doc.setFontSize(6.5*scaleFactor);doc.setTextColor(80,80,80);
    doc.text(remark,rightX+colW-4,gy+gkRowH/2+1.5*scaleFactor,{align:'right'});
  });

  y+=6*scaleFactor+traitsBodyH+4*scaleFactor;

  // ── TEACHER REMARK ──
  const remarkLines=doc.splitTextToSize(s.teacher_remark||getAutoRemark(parseFloat(avg)),178);
  const remarkH=(7+remarkLines.length*4.5)*scaleFactor;
  doc.setFillColor(255,251,235);doc.roundedRect(14,y,182,remarkH,2,2,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(7*scaleFactor);doc.setTextColor(146,64,14);doc.text("TEACHER'S REMARK",16,y+4.5*scaleFactor);
  doc.setFont('helvetica','normal');doc.setTextColor(26,26,46);doc.setFontSize(7.5*scaleFactor);
  doc.text(remarkLines,16,y+9*scaleFactor);
  y+=remarkH+4*scaleFactor;

  // ── NEXT TERM DATES ──
  if(s.next_term_begins||s.next_term_ends){
    const dtH=11*scaleFactor;
    doc.setFillColor(237,243,251);
    doc.roundedRect(14,y,88,dtH,2,2,'F');doc.roundedRect(108,y,88,dtH,2,2,'F');
    doc.setDrawColor(0,27,68);doc.roundedRect(14,y,88,dtH,2,2,'S');doc.roundedRect(108,y,88,dtH,2,2,'S');
    doc.setFont('helvetica','bold');doc.setFontSize(7*scaleFactor);doc.setTextColor(0,27,68);
    doc.text('NEXT TERM BEGINS',58,y+4.5*scaleFactor,{align:'center'});doc.text('NEXT TERM ENDS',152,y+4.5*scaleFactor,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(8*scaleFactor);doc.setTextColor(0,27,68);
    doc.text(fmt(s.next_term_begins),58,y+9*scaleFactor,{align:'center'});doc.text(fmt(s.next_term_ends),152,y+9*scaleFactor,{align:'center'});
    y+=dtH+4*scaleFactor;
  }

  // ── SIGNATURES ──
  const sigGap=14*scaleFactor;
  doc.setDrawColor(0,27,68);
  doc.line(14,y+sigGap,65,y+sigGap);doc.line(80,y+sigGap,131,y+sigGap);doc.line(145,y+sigGap,196,y+sigGap);
  doc.setFont('helvetica','normal');doc.setFontSize(8*scaleFactor);doc.setTextColor(0,27,68);
  doc.text('Class Teacher',39.5,y+sigGap+4*scaleFactor,{align:'center'});
  doc.text(s.principal_name||'Principal',105.5,y+sigGap+4*scaleFactor,{align:'center'});
  doc.text('Date',170.5,y+sigGap+4*scaleFactor,{align:'center'});

  // ── QR CODE VERIFICATION (above footer, below signatures) ──
  // Positioned at bottom-right, small and unobtrusive
  if(s.id){
    const verifyUrl=`${window.location.origin}${window.location.pathname}?verify=${s.id}`;
    const qrDataUrl=await generateQRDataURL(verifyUrl,120);
    if(qrDataUrl){
      const qrSize=18; // mm — small and neat
      const qrX=210-14-qrSize; // right-aligned, 14mm from edge
      const qrY=y+2;
      // Label above QR
      doc.setFont('helvetica','bold');doc.setFontSize(5*scaleFactor);doc.setTextColor(0,27,68);
      doc.text('SCAN TO VERIFY',qrX+(qrSize/2),qrY-1,{align:'center'});
      // Thin border box around QR
      doc.setDrawColor(0,27,68);doc.setLineWidth(0.3);
      doc.rect(qrX-0.5,qrY-0.5,qrSize+1,qrSize+1);
      doc.addImage(qrDataUrl,'PNG',qrX,qrY,qrSize,qrSize);
      // Label below QR
      doc.setFont('helvetica','normal');doc.setFontSize(4.5*scaleFactor);doc.setTextColor(74,95,122);
      doc.text('Official Result Verification',qrX+(qrSize/2),qrY+qrSize+2.5,{align:'center'});
    }
  }

  // ── FOOTER & AUTO-FIT CHECK ──
  const sigBottom=y+22;
  const A4_USABLE=279; // 297mm - 18mm margins/footer room
  // If content overflows a single A4 page and we haven't scaled too small yet, retry
  if(sigBottom>A4_USABLE&&scaleFactor>0.6&&doc.internal.getNumberOfPages()===1){
    await buildPDF(s,curClassPos,curClassTotal,subjects,scaleFactor*0.92);
    return;
  }
  const totalPages=doc.internal.getNumberOfPages();
  for(let p=1;p<=totalPages;p++){
    doc.setPage(p);
    doc.setFillColor(0,27,68);doc.rect(0,282,210,15,'F');
    doc.setFillColor(10,132,255);doc.rect(0,282,210,1.5,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(255,255,255);
    doc.text('Ambassador International Secondary School — Excellence in Education',105,291,{align:'center'});
  }
  doc.save(`Result_${s.name.replace(/\s+/g,'_')}_${s.term}_${s.session}.pdf`);
}

let allStudents=[];

async function loadStudentList(){
  const tbody=document.getElementById('students-tbody');
  tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">Loading...</td></tr>';
  const{data,error}=await db.from('students').select('*').order('created_at',{ascending:false});
  if(error){tbody.innerHTML='<tr><td colspan="7">Could not load records.</td></tr>';return;}
  allStudents=data||[];
  renderStudentTable(allStudents);
}

function renderStudentTable(students){
  const tbody=document.getElementById('students-tbody');
  if(!students.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">No students found</td></tr>';return;}
  tbody.innerHTML=students.map(s=>`
    <tr>
      <td><strong>${s.name}</strong></td><td>${s.student_id}</td><td>${s.class_name}</td>
      <td>${s.term}</td><td>${s.session}</td><td><strong>${s.grand_total}</strong></td>
      <td><div class="flex gap-8" style="flex-wrap:wrap;">
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;" onclick="viewStudentSlip('${s.id}')">👁 View</button>
        <button class="btn btn-gold" style="padding:5px 12px;font-size:12px;" onclick="openEditModal('${s.id}')">✏️ Edit</button>
        <button class="btn btn-danger" style="padding:5px 12px;font-size:12px;" onclick="deleteStudent('${s.id}','${s.name}')">🗑 Delete</button>
      </div></td>
    </tr>`).join('');
}

function filterStudents(){
  const cls=document.getElementById('filter-class').value.toLowerCase();
  const term=document.getElementById('filter-term').value.toLowerCase();
  renderStudentTable(allStudents.filter(s=>s.class_name.toLowerCase().includes(cls)&&s.term.toLowerCase().includes(term)));
}

async function viewStudentSlip(id){
  const student=allStudents.find(s=>s.id===id);if(!student)return;
  const{data:peers}=await db.from('students').select('student_id,grand_total,subjects').ilike('school_name',student.school_name||'').ilike('class_name',student.class_name||'').ilike('term',student.term||'').ilike('session',student.session||'');
  const peerList=peers||[];
  const allTotals=peerList.map(p=>p.grand_total||0);
  const classPos=denseRank(student.grand_total||0,allTotals);
  const classTotal=peerList.length||1;
  const subjectsWithPos=(student.subjects||[]).map(s=>{
    const myScore=s.total||0;
    const allSubjectScores=peerList.map(p=>{const found=(p.subjects||[]).find(x=>clean(x.subject)===clean(s.subject));return found?(found.total||0):0;});
    return{...s,position:denseRank(myScore,allSubjectScores)};
  });
  await renderResultSlip(student,classPos,classTotal,subjectsWithPos);
  showPage('result-slip-page');
}

async function deleteStudent(id,name){
  if(!confirm(`Delete result for ${name}? This cannot be undone.`))return;
  const{error}=await db.from('students').delete().eq('id',id);
  if(error){setStatus('manage-status','❌ Could not delete.','error');return;}
  setStatus('manage-status',`✅ ${name}'s result deleted`,'success');
  loadStudentList();
}

function openSendEmailModal(){document.getElementById('email-modal').classList.add('open');}

async function sendResultsToParents(){
  const term=document.getElementById('em-term').value;
  const session=document.getElementById('em-session').value.trim();
  setStatus('email-status','⏳ Loading student records...','info');
  let q=db.from('students').select('*').not('email','is',null).neq('email','');
  if(term)q=q.eq('term',term);if(session)q=q.eq('session',session);
  const{data:students,error}=await q;
  if(error){setStatus('email-status','❌ Could not load records.','error');return;}
  if(!students.length){setStatus('email-status','⚠️ No students with email addresses found.','info');return;}
  setStatus('email-status',`⏳ Sending ${students.length} emails...`,'info');
  let sent=0,failed=0;
  for(const student of students){
    const avg=student.subjects&&student.subjects.length?(student.grand_total/student.subjects.length).toFixed(1):'0.0';
    try{
      const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:FROM_EMAIL,to:student.email,subject:`${student.term} Result — ${student.name} | ${student.school_name}`,html:buildEmailHTML(student,avg)})});
      if(res.ok)sent++;else failed++;
    }catch{failed++;}
  }
  setStatus('email-status',`✅ Done! ${sent} sent.${failed>0?' '+failed+' failed.':''}`,'success');
}

function buildEmailHTML(s,avg){
  return`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:10px;overflow:hidden;">
    <div style="background:#0a1f44;color:white;padding:24px;text-align:center;">
      <h2 style="margin:0;font-size:20px;">${(s.school_name||'AMBASSADOR INTERNATIONAL SECONDARY SCHOOL').toUpperCase()}</h2>
      <p style="margin:6px 0 0;opacity:0.8;font-size:13px;">${s.term} Academic Result — ${s.session}</p>
    </div>
    <div style="padding:24px;">
      <p style="font-size:15px;">Dear Parent/Guardian of <strong>${s.name}</strong>,</p>
      <p style="color:#555;font-size:14px;margin-top:8px;">Please find below a summary of your child's academic performance for <strong>${s.term}</strong>, <strong>${s.session}</strong>.</p>
      <div style="background:#edf0f8;border-radius:8px;padding:16px;margin:16px 0;font-size:13px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #c5cde0;"><td style="padding:6px 0;"><strong>Class:</strong></td><td>${s.class_name}</td><td><strong>Grand Total:</strong></td><td><strong>${s.grand_total}</strong></td></tr>
          <tr style="border-bottom:1px solid #c5cde0;"><td style="padding:6px 0;"><strong>Average:</strong></td><td>${avg}%</td><td><strong>Subjects:</strong></td><td>${(s.subjects||[]).length}</td></tr>
          <tr><td style="padding:6px 0;" colspan="4"><strong>Remark:</strong> ${s.teacher_remark||''}</td></tr>
        </table>
      </div>
      ${s.next_term_begins?`<div style="background:#fffbeb;padding:12px;border-radius:8px;font-size:13px;margin-bottom:16px;">📅 <strong>Next Term Begins:</strong> ${fmt(s.next_term_begins)} &nbsp;&nbsp; <strong>Ends:</strong> ${fmt(s.next_term_ends)}</div>`:''}
      <div style="background:#0a1f44;color:white;border-radius:10px;padding:20px;text-align:center;margin-top:20px;">
        <strong>Ambassador International Secondary School</strong>
      </div>
      <p style="font-size:10px;color:#aaa;text-align:center;margin-top:16px;">Ambassador International Secondary School — <strong style="color:#ffffff;">Excellence in Education</strong></p>
    </div>
  </div>`;
}

let chartInstances={};
function destroyChart(id){if(chartInstances[id]){chartInstances[id].destroy();delete chartInstances[id];}}

async function loadAnalytics(){
  document.getElementById('analytics-loading').classList.remove('hidden');
  document.getElementById('analytics-content').classList.add('hidden');
  const term=document.getElementById('analytics-term').value;
  const session=document.getElementById('analytics-session').value.trim();
  let q=db.from('students').select('*');
  if(term)q=q.eq('term',term);if(session)q=q.eq('session',session);
  const{data:students,error}=await q;
  if(error||!students||!students.length){document.getElementById('analytics-loading').textContent='No data found.';return;}
  document.getElementById('analytics-loading').classList.add('hidden');
  document.getElementById('analytics-content').classList.remove('hidden');
  const total=students.length;
  const schoolAvg=(students.reduce((a,s)=>a+(s.average||0),0)/total).toFixed(1);
  const passed=students.filter(s=>(s.average||0)>=PASS_MARK).length;
  const passRate=((passed/total)*100).toFixed(0);
  const classes=[...new Set(students.map(s=>s.class_name))];
  document.getElementById('a-stats').innerHTML=`
    <div class="stat-card"><div class="num">${total}</div><div class="lbl">Total Students</div></div>
    <div class="stat-card"><div class="num">${schoolAvg}%</div><div class="lbl">School Average</div></div>
    <div class="stat-card"><div class="num">${passed}</div><div class="lbl">Passed (≥${PASS_MARK}%)</div></div>
    <div class="stat-card"><div class="num">${total-passed}</div><div class="lbl">Below Average</div></div>
    <div class="stat-card"><div class="num">${passRate}%</div><div class="lbl">Pass Rate</div></div>
    <div class="stat-card"><div class="num">${classes.length}</div><div class="lbl">Classes</div></div>`;
  const males=students.filter(s=>clean(s.gender)==='male');
  const females=students.filter(s=>clean(s.gender)==='female');
  const mAvg=males.length?(males.reduce((a,s)=>a+(s.average||0),0)/males.length).toFixed(1):0;
  const fAvg=females.length?(females.reduce((a,s)=>a+(s.average||0),0)/females.length).toFixed(1):0;
  destroyChart('chart-gender');
  chartInstances['chart-gender']=new Chart(document.getElementById('chart-gender'),{type:'bar',data:{labels:[`Male (${males.length})`,`Female (${females.length})`],datasets:[{label:'Average Score (%)',data:[mAvg,fAvg],backgroundColor:['rgba(0,27,68,0.85)','rgba(10,132,255,0.75)'],borderRadius:8}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}});
  const clsData=classes.map(cls=>{const g=students.filter(s=>s.class_name===cls);return{cls,avg:(g.reduce((a,s)=>a+(s.average||0),0)/g.length).toFixed(1),count:g.length};}).sort((a,b)=>b.avg-a.avg);
  destroyChart('chart-class');
  chartInstances['chart-class']=new Chart(document.getElementById('chart-class'),{type:'bar',data:{labels:clsData.map(x=>x.cls+' ('+x.count+')'),datasets:[{label:'Average (%)',data:clsData.map(x=>x.avg),backgroundColor:'rgba(0,27,68,0.80)',borderRadius:6}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,max:100}}}});
  const gc={'A':0,'B':0,'C':0,'D':0,'E':0};
  students.forEach(s=>(s.subjects||[]).forEach(sub=>{
    const g=getGrade(sub.total);
    if(gc[g]!==undefined)gc[g]++;
  }));
  destroyChart('chart-grades');
  chartInstances['chart-grades']=new Chart(document.getElementById('chart-grades'),{type:'doughnut',data:{labels:['A — Distinction','B — Very Good','C — Good','D — Fair','E — Poor'],datasets:[{data:Object.values(gc),backgroundColor:['#001B44','#003366','#0A84FF','#3da0ff','#dc2626']}]},options:{plugins:{legend:{position:'right'}}}});
  const subMap={};
  students.forEach(s=>(s.subjects||[]).forEach(sub=>{if(!subMap[sub.subject])subMap[sub.subject]=[];subMap[sub.subject].push(sub.total);}));
  const subNames=Object.keys(subMap);
  const subAvgs=subNames.map(n=>(subMap[n].reduce((a,b)=>a+b,0)/subMap[n].length).toFixed(1));
  destroyChart('chart-subjects');
  chartInstances['chart-subjects']=new Chart(document.getElementById('chart-subjects'),{type:'bar',data:{labels:subNames,datasets:[{label:'Avg Score',data:subAvgs,backgroundColor:'rgba(10,132,255,0.75)',borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}});
  document.getElementById('a-top-students').innerHTML=classes.map(cls=>{
    const grp=students.filter(s=>s.class_name===cls).sort((a,b)=>b.grand_total-a.grand_total).slice(0,3);
    const allInClass=students.filter(s=>s.class_name===cls).map(s=>s.grand_total||0);
    return`<div class="top-card"><h4>📚 ${cls}</h4>${grp.map(s=>{const rank=denseRank(s.grand_total||0,allInClass);return`<div class="top-student"><div class="rank-badge ${rank<=3?'rank-'+rank:''}">${rank}</div><div><div style="font-weight:600">${s.name}</div><div style="font-size:11px;color:var(--muted)">${s.student_id} | Total: ${s.grand_total} | Avg: ${s.average}%</div></div></div>`;}).join('')}</div>`;
  }).join('');
  const atRisk=students.filter(s=>(s.subjects||[]).filter(sub=>sub.total<AT_RISK_SCORE).length>=AT_RISK_MIN_SUBJECTS);
  document.getElementById('a-at-risk').innerHTML=atRisk.length
    ?atRisk.map(s=>{const fc=(s.subjects||[]).filter(sub=>sub.total<AT_RISK_SCORE).length;return`<li class="at-risk-item"><div><div class="name">${s.name}</div><div class="meta">${s.student_id} | ${s.class_name} | Avg: ${s.average}%</div></div><span class="fail-badge">${fc} Failed</span></li>`;}).join('')
    :'<li class="alert alert-success">✅ No at-risk students found.</li>';
}

function openDeployModal(){document.getElementById('deploy-modal').classList.add('open');}

async function deployAnnualResult(){
  const session=document.getElementById('deploy-session').value.trim();
  if(!session){setStatus('deploy-status','❌ Please enter the session','error');return;}
  const btn=document.getElementById('deploy-btn');
  btn.disabled=true;
  document.getElementById('deploy-progress-bar').style.width='0%';
  document.getElementById('deploy-progress-wrap').classList.remove('hidden');
  setStatus('deploy-status','⏳ Fetching student records...','info');
  const{data:allRecords,error:fetchErr}=await db.from('students').select('student_id,name,class_name,session,term,average').ilike('session',session);
  if(fetchErr){setStatus('deploy-status',`❌ Could not fetch records.<br/><small>${fetchErr.message}</small>`,'error');btn.disabled=false;return;}
  if(!allRecords||!allRecords.length){setStatus('deploy-status','❌ No student records found for this session.','error');btn.disabled=false;return;}
  const studentMap={};
  allRecords.forEach(r=>{
    const key=(r.student_id||'').toLowerCase();
    if(!studentMap[key])studentMap[key]={student_id:r.student_id,name:r.name,class_name:r.class_name,session:r.session,terms:{}};
    const termKey=(r.term||'').toLowerCase();
    if(termKey.includes('first'))studentMap[key].terms.first=parseFloat(r.average)||0;
    if(termKey.includes('second'))studentMap[key].terms.second=parseFloat(r.average)||0;
    if(termKey.includes('third'))studentMap[key].terms.third=parseFloat(r.average)||0;
  });
  const allStudentsList=Object.values(studentMap);
  const complete=allStudentsList.filter(s=>s.terms.first!==undefined&&s.terms.second!==undefined&&s.terms.third!==undefined);
  const incomplete=allStudentsList.filter(s=>s.terms.first===undefined||s.terms.second===undefined||s.terms.third===undefined);
  if(complete.length===0){
    const missing=incomplete.map(s=>{const lacking=[];if(s.terms.first===undefined)lacking.push('1st');if(s.terms.second===undefined)lacking.push('2nd');if(s.terms.third===undefined)lacking.push('3rd');return`${s.name} (${s.student_id}) — missing: ${lacking.join(', ')}`;});
    setStatus('deploy-status',`❌ No student has all 3 terms for <strong>${session}</strong>.<br/><small>${missing.slice(0,10).join('<br/>')}${missing.length>10?`<br/>...and ${missing.length-10} more.`:''}</small>`,'error');
    btn.disabled=false;return;
  }
  let warningHTML='';
  if(incomplete.length>0)warningHTML=`<div class="alert alert-warning" style="margin-top:8px;font-size:12px;">⚠️ <strong>${incomplete.length} student(s) skipped</strong> — missing terms.</div>`;
  let done=0,saved=0,failed=0;
  setStatus('deploy-status',`⏳ Processing ${complete.length} student(s)...`,'info');
  for(const s of complete){
    const first=s.terms.first,second=s.terms.second,third=s.terms.third;
    const annual_average=parseFloat(((first+second+third)/3).toFixed(2));
    const grade=getGrade(annual_average);
    const promotion_status=annual_average>=PASS_MARK?'Promoted':'Not Promoted';
    const payload={student_id:s.student_id,full_name:s.name,class:s.class_name,session:s.session,first_term:first,second_term:second,third_term:third,annual_average,grade,status:'published',promotion_status};
    const{error:uErr}=await db.from('annual_results').upsert(payload,{onConflict:'student_id,session',ignoreDuplicates:false});
    if(uErr){
      console.error(uErr);
      if(uErr.message&&(uErr.message.includes('does not exist')||uErr.code==='42P01')){setStatus('deploy-status','❌ <strong>annual_results table does not exist.</strong> Please contact your system administrator to set up the database.','error');btn.disabled=false;return;}
      failed++;
    }else{saved++;}
    done++;
    document.getElementById('deploy-progress-bar').style.width=Math.round((done/complete.length)*100)+'%';
    document.getElementById('deploy-progress-label').textContent=`Processing ${done} of ${complete.length}...`;
  }
  btn.disabled=false;
  if(failed===0){document.getElementById('deploy-status').innerHTML=`<div class="alert alert-success">✅ ${saved} student(s) deployed for <strong>${session}</strong>.</div>${warningHTML}`;}
  else{document.getElementById('deploy-status').innerHTML=`<div class="alert alert-warning">⚠️ ${saved} saved, ${failed} failed.</div>${warningHTML}`;}
}

async function fetchAnnualResult(){
  const idRaw=document.getElementById('as-id').value.trim();
  const session=document.getElementById('as-session').value.trim();
  if(!idRaw||!session){setStatus('as-status','❌ Please fill in both fields','error');return;}
  setStatus('as-status','⏳ Searching...','info');
  const{data,error}=await db.from('annual_results').select('*').ilike('student_id',idRaw).ilike('session',session).eq('status','published').maybeSingle();
  if(error){
    if(error.message&&(error.message.includes('does not exist')||error.code==='42P01')){setStatus('as-status','❌ Annual results not set up yet. Contact the school.','error');}
    else{setStatus('as-status','❌ A database error occurred.','error');console.error(error);}
    return;
  }
  if(!data){setStatus('as-status',`<strong>Annual result not yet released</strong><br/><small>No result found for ID <strong>${idRaw}</strong>, session <strong>${session}</strong>.</small>`,'error');return;}
  setStatus('as-status','','info');
  const blockedA=await checkFeeDefaulter(data.student_id,data.full_name);
  if(blockedA)return;
  renderAnnualSlip(data);
  showPage('annual-slip-page');
}

let annualAppState=null;

function renderAnnualSlip(d){
  annualAppState=d;
  document.getElementById('annual-slip-logo').src=SCHOOL_LOGO_URL;
  document.getElementById('annual-slip-school').textContent='AMBASSADOR INTERNATIONAL SECONDARY SCHOOL';
  document.getElementById('annual-slip-session-label').textContent=`ANNUAL RESULT — ${d.session}`;
  document.getElementById('annual-slip-principal').textContent='PRINCIPAL';
  document.getElementById('annual-slip-info-grid').innerHTML=[
    ['Student Name',(d.full_name||'').toUpperCase()],
    ['Student ID',d.student_id],
    ['Class',d.class],
    ['Session',d.session],
    ['Status',d.promotion_status||d.status],
  ].map(([k,v])=>`<div class="slip-info-item"><strong>${k}:</strong><span>${v}</span></div>`).join('');
  document.getElementById('annual-term-scores').innerHTML=`
    <div class="annual-term-box"><div class="term-label">1st Term</div><div class="term-val">${parseFloat(d.first_term||0).toFixed(1)}</div><div style="font-size:11px;color:var(--muted);">Average</div></div>
    <div class="annual-term-box"><div class="term-label">2nd Term</div><div class="term-val">${parseFloat(d.second_term||0).toFixed(1)}</div><div style="font-size:11px;color:var(--muted);">Average</div></div>
    <div class="annual-term-box"><div class="term-label">3rd Term</div><div class="term-val">${parseFloat(d.third_term||0).toFixed(1)}</div><div style="font-size:11px;color:var(--muted);">Average</div></div>`;
  const isPass=(d.annual_average||0)>=PASS_MARK;
  document.getElementById('annual-final-box').innerHTML=`
    <div class="fa-label">Annual Average</div>
    <div class="fa-val">${parseFloat(d.annual_average||0).toFixed(1)}%</div>
    <div class="fa-grade">Grade: ${d.grade}</div>
    <div class="annual-status-badge ${isPass?'annual-status-pass':'annual-status-fail'}">
      ${isPass?'✅ '+(d.promotion_status||'Promoted'):'❌ '+(d.promotion_status||'Not Promoted')}
    </div>`;
}

function downloadAnnualPDF(){
  const d=annualAppState;if(!d)return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  doc.setFillColor(0,27,68);doc.rect(0,0,210,32,'F');
  doc.setFillColor(10,132,255);doc.rect(0,30,210,2.5,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(17);
  doc.text('AMBASSADOR INTERNATIONAL SECONDARY SCHOOL',105,13,{align:'center'});
  doc.setFontSize(8);doc.setFont('helvetica','normal');
  doc.text('ANNUAL ACADEMIC REPORT',105,21,{align:'center'});
  doc.setFillColor(237,243,251);doc.rect(0,32,210,9,'F');
  doc.setDrawColor(0,27,68);doc.line(0,41,210,41);
  doc.setTextColor(0,27,68);doc.setFont('helvetica','bold');doc.setFontSize(9);
  doc.text(`ANNUAL RESULT — ${d.session}`,105,38,{align:'center'});
  let y=48;doc.setFontSize(8);doc.setTextColor(0,27,68);
  const iL=[['Student Name',(d.full_name||'').toUpperCase()],['Student ID',d.student_id]];
  const iR=[['Class',d.class],['Session',d.session]];
  iL.forEach(([k,v],i)=>{doc.setFont('helvetica','bold');doc.text(k+':',14,y+i*6);doc.setFont('helvetica','normal');doc.text(String(v||''),52,y+i*6);});
  iR.forEach(([k,v],i)=>{doc.setFont('helvetica','bold');doc.text(k+':',110,y+i*6);doc.setFont('helvetica','normal');doc.text(String(v||''),147,y+i*6);});
  y+=18;
  doc.autoTable({startY:y,head:[['Term','Average Score','Grade']],
    body:[['First Term',parseFloat(d.first_term||0).toFixed(1)+'%',getGrade(parseFloat(d.first_term||0))],['Second Term',parseFloat(d.second_term||0).toFixed(1)+'%',getGrade(parseFloat(d.second_term||0))],['Third Term',parseFloat(d.third_term||0).toFixed(1)+'%',getGrade(parseFloat(d.third_term||0))]],
    headStyles:{fillColor:[0,27,68],fontSize:9,halign:'center'},bodyStyles:{fontSize:9,halign:'center'},columnStyles:{0:{halign:'left',fontStyle:'bold'}},alternateRowStyles:{fillColor:[237,243,251]},margin:{left:14,right:14}});
  y=doc.lastAutoTable.finalY+10;
  doc.setFillColor(0,27,68);doc.roundedRect(14,y,182,24,3,3,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);
  doc.text('ANNUAL AVERAGE',105,y+8,{align:'center'});
  doc.setFontSize(18);doc.setTextColor(139,191,255);doc.text(`${parseFloat(d.annual_average||0).toFixed(1)}%  |  Grade: ${d.grade}`,105,y+18,{align:'center'});
  y+=30;
  const isPass=(d.annual_average||0)>=PASS_MARK;
  doc.setFillColor(isPass?220:254,isPass?252:226,isPass?231:226);
  doc.roundedRect(14,y,182,12,3,3,'F');
  doc.setTextColor(isPass?22:220,isPass?163:38,isPass?74:38);
  doc.setFont('helvetica','bold');doc.setFontSize(10);
  doc.text((isPass?'✓ PROMOTED — ':'✗ NOT PROMOTED — ')+(d.promotion_status||d.status).toUpperCase(),105,y+8,{align:'center'});
  y+=22;
  // GRADING KEY
  doc.setFillColor(0,27,68);doc.roundedRect(14,y,182,7,2,2,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(255,255,255);
  doc.text('GRADING KEY',105,y+4.5,{align:'center'});
  y+=8;
  const gkData2=[['A','75 & Above','Distinction'],['B','65 - 74','Very Good'],['C','55 - 64','Good'],['D','40 - 54','Fair'],['E','0 - 39','Poor']];
  const gkW2=182/5;
  const gkH2=16;
  gkData2.forEach(([grade,range,remark],i)=>{
    const gx=14+(i*gkW2);
    doc.setFillColor(i%2===0?237:248,i%2===0?243:250,i%2===0?251:252);
    doc.rect(gx,y,gkW2,gkH2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(0,27,68);
    doc.text(grade,gx+gkW2/2,y+5.5,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(50,50,50);
    doc.text(range,gx+gkW2/2,y+10,{align:'center'});
    doc.setFont('helvetica','italic');doc.setFontSize(6);doc.setTextColor(80,80,80);
    doc.text(remark,gx+gkW2/2,y+14,{align:'center'});
  });
  y+=gkH2+6;
  doc.setDrawColor(0,27,68);doc.setTextColor(0,27,68);doc.setFont('helvetica','normal');doc.setFontSize(8);
  doc.line(14,y+16,65,y+16);doc.line(80,y+16,131,y+16);doc.line(145,y+16,196,y+16);
  doc.text('Class Teacher',39.5,y+20,{align:'center'});
  doc.text('Principal',105.5,y+20,{align:'center'});
  doc.text('Date',170.5,y+20,{align:'center'});
  // Footer — dark blue
  doc.setFillColor(0,27,68);doc.rect(0,282,210,15,'F');
  doc.setFillColor(10,132,255);doc.rect(0,282,210,1.5,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(255,255,255);
  doc.text('Ambassador International Secondary School — Excellence in Education',105,291,{align:'center'});
  doc.save(`Annual_Result_${(d.full_name||'student').replace(/\s+/g,'_')}_${d.session}.pdf`);
}

// ════════════════════════════════════════════
// EDIT STUDENT MODAL FUNCTIONS
// ════════════════════════════════════════════
function openEditModal(id){
  const s=allStudents.find(x=>x.id===id);
  if(!s)return;
  document.getElementById('edit-db-id').value=s.id;
  document.getElementById('edit-name').value=s.name||'';
  document.getElementById('edit-id').value=s.student_id||'';
  document.getElementById('edit-gender').value=s.gender||'';
  document.getElementById('edit-age').value=s.age||'';
  document.getElementById('edit-class').value=s.class_name||'';
  document.getElementById('edit-term').value=s.term||'';
  document.getElementById('edit-session').value=s.session||'';
  document.getElementById('edit-school').value=s.school_name||'';
  document.getElementById('edit-email').value=s.email||'';
  document.getElementById('edit-phone').value=s.phone||'';
  document.getElementById('edit-principal').value=s.principal_name||'';
  document.getElementById('edit-remark').value=s.teacher_remark||'';
  // Dates
  document.getElementById('edit-next-begin').value=s.next_term_begins?s.next_term_begins.split('T')[0]:'';
  document.getElementById('edit-next-end').value=s.next_term_ends?s.next_term_ends.split('T')[0]:'';
  // Traits
  ['neatness','obedience','punctuality','attentiveness','initiative','selfcontrol'].forEach(t=>{
    const key=t==='selfcontrol'?'self_control':t;
    const el=document.getElementById('edit-'+t);
    if(el&&s[key])el.value=String(s[key]);
  });
  // Subjects
  const c=document.getElementById('edit-subjects-container');
  c.innerHTML='';
  (s.subjects||[]).forEach(sub=>addEditSubjectRow(sub));
  if(!(s.subjects&&s.subjects.length))addEditSubjectRow();
  setStatus('edit-status','','info');
  document.getElementById('edit-modal').classList.add('open');
}

function closeEditModal(){
  document.getElementById('edit-modal').classList.remove('open');
}

function addEditSubjectRow(data){
  const c=document.getElementById('edit-subjects-container');
  const d=document.createElement('div');
  d.className='subject-row';
  d.innerHTML=`
    <div class="field"><input class="subj-name" placeholder="Subject name" value="${data&&data.subject?data.subject:''}"/></div>
    <div class="field"><input class="subj-ca1" type="number" min="0" max="100" placeholder="0" value="${data&&data.ca1!=null?data.ca1:''}" oninput="calcEditTotal(this)"/></div>
    <div class="field"><input class="subj-ca2" type="number" min="0" max="100" placeholder="0" value="${data&&data.ca2!=null?data.ca2:''}" oninput="calcEditTotal(this)"/></div>
    <div class="field"><input class="subj-ca3" type="number" min="0" max="100" placeholder="0" value="${data&&data.ca3!=null?data.ca3:''}" oninput="calcEditTotal(this)"/></div>
    <div class="field"><input class="subj-exam" type="number" min="0" max="100" placeholder="0" value="${data&&data.exam!=null?data.exam:''}" oninput="calcEditTotal(this)"/></div>
    <div class="field"><input class="subj-total" readonly style="background:#edf0f8;font-weight:700;color:var(--primary);" value="${data&&data.total!=null?data.total:'0'}"/></div>
    <button class="remove-btn" onclick="this.closest('.subject-row').remove()">✕</button>`;
  c.appendChild(d);
}

function calcEditTotal(inp){
  const row=inp.closest('.subject-row');
  const ca1=Number(row.querySelector('.subj-ca1').value)||0;
  const ca2=Number(row.querySelector('.subj-ca2').value)||0;
  const ca3=Number(row.querySelector('.subj-ca3').value)||0;
  const exam=Number(row.querySelector('.subj-exam').value)||0;
  row.querySelector('.subj-total').value=ca1+ca2+ca3+exam;
}

async function saveEditedStudent(){
  const dbId=document.getElementById('edit-db-id').value;
  const name=document.getElementById('edit-name').value.trim();
  const studentId=document.getElementById('edit-id').value.trim();
  const cls=document.getElementById('edit-class').value.trim();
  const term=document.getElementById('edit-term').value;
  const session=document.getElementById('edit-session').value.trim();
  if(!name||!studentId||!cls||!term||!session){
    setStatus('edit-status','❌ Name, ID, Class, Term and Session are required.','error');return;
  }
  const rows=document.getElementById('edit-subjects-container').querySelectorAll('.subject-row');
  const subjects=[];
  for(const r of rows){
    const sn=r.querySelector('.subj-name').value.trim();
    if(!sn){setStatus('edit-status','❌ All subject names must be filled.','error');return;}
    const ca1=Number(r.querySelector('.subj-ca1').value)||0;
    const ca2=Number(r.querySelector('.subj-ca2').value)||0;
    const ca3=Number(r.querySelector('.subj-ca3').value)||0;
    const exam=Number(r.querySelector('.subj-exam').value)||0;
    for(const[lbl,val]of[['CA1',ca1],['CA2',ca2],['CA3',ca3],['Exam',exam]]){
      if(val<0||val>100){setStatus('edit-status',`❌ ${lbl} for "${sn}" must be 0–100.`,'error');return;}
    }
    const total=ca1+ca2+ca3+exam;
    subjects.push({subject:sn,ca1,ca2,ca3,exam,total,grade:getGrade(total)});
  }
  const grandTotal=subjects.reduce((a,s)=>a+s.total,0);
  const average=subjects.length?parseFloat((grandTotal/subjects.length).toFixed(2)):0;
  const payload={
    name,student_id:studentId,
    gender:document.getElementById('edit-gender').value,
    age:document.getElementById('edit-age').value,
    school_name:document.getElementById('edit-school').value.trim(),
    class_name:cls,term,session,
    email:document.getElementById('edit-email').value.trim(),
    phone:document.getElementById('edit-phone').value.trim(),
    neatness:document.getElementById('edit-neatness').value,
    obedience:document.getElementById('edit-obedience').value,
    punctuality:document.getElementById('edit-punctuality').value,
    attentiveness:document.getElementById('edit-attentiveness').value,
    initiative:document.getElementById('edit-initiative').value,
    self_control:document.getElementById('edit-selfcontrol').value,
    teacher_remark:document.getElementById('edit-remark').value.trim(),
    principal_name:document.getElementById('edit-principal').value.trim(),
    next_term_begins:document.getElementById('edit-next-begin').value||null,
    next_term_ends:document.getElementById('edit-next-end').value||null,
    subjects,grand_total:grandTotal,average
  };
  const btn=document.getElementById('edit-save-btn');
  btn.disabled=true;btn.textContent='⏳ Saving...';
  setStatus('edit-status','⏳ Saving changes...','info');
  const{error}=await db.from('students').update(payload).eq('id',dbId);
  btn.disabled=false;btn.textContent='💾 Save Changes';
  if(error){console.error(error);setStatus('edit-status','❌ Could not save. Please try again.','error');return;}
  setStatus('edit-status',`✅ Record for <strong>${name}</strong> updated successfully!`,'success');
  setTimeout(()=>{closeEditModal();loadStudentList();setStatus('manage-status',`✅ ${name}'s record updated.`,'success');},900);
}


// ════════════════════════════════════════════════════════════
// FEE DEFAULTERS — CASHIER SIDE
// ════════════════════════════════════════════════════════════
let allFeeDefaulters=[];

async function loadFeeDefaulters(){
  const tbody=document.getElementById('fee-defaulters-tbody');
  tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">⏳ Loading...</td></tr>';
  const{data,error}=await db.from('fee_defaulters').select('*').order('created_at',{ascending:false});
  if(error){
    tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--danger)">❌ Could not load: ${error.message}</td></tr>`;
    return;
  }
  allFeeDefaulters=data||[];
  renderFeeTable(allFeeDefaulters);
}

function renderFeeTable(list){
  const tbody=document.getElementById('fee-defaulters-tbody');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">✅ No fee defaulters on record.</td></tr>';
    return;
  }
  tbody.innerHTML=list.map(d=>`
    <tr>
      <td><strong>${d.student_name}</strong></td>
      <td>${d.student_id}</td>
      <td>${d.class_name}</td>
      <td>${d.term}</td>
      <td>${d.session}</td>
      <td><button class="btn btn-success" style="padding:5px 12px;font-size:12px;" onclick="removeFeeDefaulter('${d.id}','${d.student_name}')">✅ Remove (Paid)</button></td>
    </tr>`).join('');
}

function filterFeeDefaulters(){
  const q=document.getElementById('fee-filter').value.toLowerCase();
  renderFeeTable(allFeeDefaulters.filter(d=>
    d.student_name.toLowerCase().includes(q)||
    d.class_name.toLowerCase().includes(q)||
    d.student_id.toLowerCase().includes(q)
  ));
}

async function removeFeeDefaulter(id,name){
  if(!confirm(`Remove ${name} from the defaulters list? This means they have paid.`))return;
  const{error}=await db.from('fee_defaulters').delete().eq('id',id);
  if(error){setStatus('fee-status','❌ Could not remove. Please try again.','error');return;}
  setStatus('fee-status',`✅ ${name} removed successfully.`,'success');
  loadFeeDefaulters();
}

function openAddDefaulterModal(){
  document.getElementById('df-student-id').value='';
  document.getElementById('df-lookup-result').style.display='none';
  document.getElementById('df-save-btn').disabled=true;
  setStatus('df-status','','info');
  document.getElementById('add-defaulter-modal').classList.add('open');
}
function closeAddDefaulterModal(){document.getElementById('add-defaulter-modal').classList.remove('open');}

async function lookupDefaulterStudent(){
  const idRaw=document.getElementById('df-student-id').value.trim();
  if(!idRaw){setStatus('df-status','❌ Please enter a Student ID.','error');return;}
  setStatus('df-status','⏳ Looking up student...','info');
  const{data,error}=await db.from('students').select('name,student_id,class_name,term,session')
    .ilike('student_id',idRaw).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error||!data){
    setStatus('df-status',`❌ No student found with ID <strong>${idRaw}</strong>.`,'error');
    document.getElementById('df-lookup-result').style.display='none';
    document.getElementById('df-save-btn').disabled=true;
    return;
  }
  setStatus('df-status','','info');
  document.getElementById('df-name').value=data.name;
  document.getElementById('df-class').value=data.class_name;
  document.getElementById('df-term').value=data.term;
  document.getElementById('df-session').value=data.session;
  document.getElementById('df-student-name-display').textContent=data.name;
  document.getElementById('df-student-meta-display').textContent=`${data.class_name} • ${data.term} • ${data.session}`;
  document.getElementById('df-lookup-result').style.display='block';
  document.getElementById('df-save-btn').disabled=false;
}

async function saveDefaulter(){
  const studentId=document.getElementById('df-student-id').value.trim();
  const name=document.getElementById('df-name').value;
  const cls=document.getElementById('df-class').value;
  const term=document.getElementById('df-term').value;
  const session=document.getElementById('df-session').value;
  if(!studentId||!name){setStatus('df-status','❌ Please look up a valid student first.','error');return;}
  const{data:existing}=await db.from('fee_defaulters').select('id').ilike('student_id',studentId).maybeSingle();
  if(existing){setStatus('df-status','⚠️ This student is already in the defaulters list.','error');return;}
  const btn=document.getElementById('df-save-btn');
  btn.disabled=true;btn.textContent='⏳ Saving...';
  const{error}=await db.from('fee_defaulters').insert({
    student_id:studentId,student_name:name,class_name:cls,term,session
  });
  btn.disabled=false;btn.textContent='🚫 Add to Defaulters';
  if(error){setStatus('df-status',`❌ Save failed: ${error.message}`,'error');return;}
  setTimeout(()=>{closeAddDefaulterModal();loadFeeDefaulters();setStatus('fee-status',`✅ ${name} added to defaulters list.`,'success');},800);
}

// ════════════════════════════════════════════════════════════
// FEE GATE CHECK — runs before any result is displayed
// ════════════════════════════════════════════════════════════
async function checkFeeDefaulter(studentId,studentName){
  try{
    const{data,error}=await db.from('fee_defaulters').select('id').ilike('student_id',studentId).maybeSingle();
    if(error){console.error('Fee check error:',error);return false;}
    if(data){
      document.getElementById('fee-gate-message').innerHTML=
        `Hi <strong>${studentName}</strong>, you have an outstanding school fees balance. `+
        `Kindly complete your school fees payment to access your result.`;
      document.getElementById('fee-gate-modal').classList.add('open');
      return true;
    }
    return false;
  }catch(e){console.error(e);return false;}
}

checkSession();

// ════════════════════════════════════════════════════════════
// QR CODE VERIFICATION — auto-runs if ?verify=UUID in URL
// When a parent/employer scans the QR code, this loads their
// result directly from Supabase and displays it on screen.
// ════════════════════════════════════════════════════════════
async function handleVerifyParam(){
  const params=new URLSearchParams(window.location.search);
  const verifyId=params.get('verify');
  if(!verifyId)return; // normal page load — do nothing

  // Hide all normal pages, show the verify page
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const vPage=document.getElementById('verify-page');
  if(vPage)vPage.classList.add('active');
  const backLink=document.getElementById('verify-back-link');
  if(backLink)backLink.href=window.location.pathname;

  const vStatus=document.getElementById('verify-status');
  const vCard=document.getElementById('verify-card');
  vStatus.innerHTML='<div style="text-align:center;padding:40px;font-size:15px;color:#001B44;">⏳ Loading result from database...</div>';

  const{data:s,error}=await db.from('students').select('*').eq('id',verifyId).maybeSingle();
  if(error||!s){
    vStatus.innerHTML='<div style="text-align:center;padding:40px;color:#dc2626;font-size:15px;">❌ Result not found or this QR code is invalid.</div>';
    return;
  }

  // Compute average
  const subj=s.subjects||[];
  const avg=subj.length?(s.grand_total/subj.length).toFixed(1):'0.0';

  vStatus.innerHTML='';
  vCard.style.display='block';
  vCard.innerHTML=`
    <div style="background:#001B44;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:16px;">
      <div style="flex:1;">
        <div style="font-size:11px;letter-spacing:1px;opacity:0.7;margin-bottom:4px;">OFFICIAL RESULT VERIFICATION</div>
        <div style="font-size:20px;font-weight:700;">${(s.school_name||'AMBASSADOR INTERNATIONAL SECONDARY SCHOOL').toUpperCase()}</div>
        <div style="font-size:12px;opacity:0.8;margin-top:4px;">Student Academic Report — ${s.term||''} ${s.session||''}</div>
      </div>
      <div style="background:#16a34a;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;white-space:nowrap;">✅ VERIFIED</div>
    </div>
    <div style="padding:20px 24px;background:#f0f4ff;display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;font-size:13px;">
      <div><span style="color:#4a5f7a;font-size:11px;">STUDENT NAME</span><div style="font-weight:700;color:#001B44;">${s.name||'—'}</div></div>
      <div><span style="color:#4a5f7a;font-size:11px;">STUDENT ID</span><div style="font-weight:700;color:#001B44;">${s.student_id||'—'}</div></div>
      <div><span style="color:#4a5f7a;font-size:11px;">CLASS</span><div style="font-weight:700;color:#001B44;">${s.class_name||'—'}</div></div>
      <div><span style="color:#4a5f7a;font-size:11px;">GENDER</span><div style="font-weight:700;color:#001B44;">${(s.gender||'—').toUpperCase()}</div></div>
      <div><span style="color:#4a5f7a;font-size:11px;">TERM</span><div style="font-weight:700;color:#001B44;">${s.term||'—'}</div></div>
      <div><span style="color:#4a5f7a;font-size:11px;">SESSION</span><div style="font-weight:700;color:#001B44;">${s.session||'—'}</div></div>
    </div>
    <div style="padding:16px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#001B44;color:#fff;">
            <th style="padding:8px 10px;text-align:left;border-radius:4px 0 0 4px;">Subject</th>
            <th style="padding:8px 6px;text-align:center;">CA1</th>
            <th style="padding:8px 6px;text-align:center;">CA2</th>
            <th style="padding:8px 6px;text-align:center;">CA3</th>
            <th style="padding:8px 6px;text-align:center;">Exam</th>
            <th style="padding:8px 6px;text-align:center;">Total</th>
            <th style="padding:8px 10px;text-align:center;border-radius:0 4px 4px 0;">Grade</th>
          </tr>
        </thead>
        <tbody>
          ${subj.map((sub,i)=>`
            <tr style="background:${i%2===0?'#edf0f8':'#fff'};">
              <td style="padding:7px 10px;font-weight:600;color:#001B44;">${sub.subject||''}</td>
              <td style="padding:7px 6px;text-align:center;">${sub.ca1??'—'}</td>
              <td style="padding:7px 6px;text-align:center;">${sub.ca2??'—'}</td>
              <td style="padding:7px 6px;text-align:center;">${sub.ca3??'—'}</td>
              <td style="padding:7px 6px;text-align:center;">${sub.exam??'—'}</td>
              <td style="padding:7px 6px;text-align:center;font-weight:700;color:#001B44;">${sub.total??'—'}</td>
              <td style="padding:7px 10px;text-align:center;font-weight:700;color:${sub.grade==='A'?'#16a34a':sub.grade==='E'?'#dc2626':'#001B44'};">${sub.grade||'—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:4px 24px 20px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;">
      <div style="background:#edf0f8;border-radius:8px;padding:12px;border:1.5px solid #001B44;">
        <div style="font-size:20px;font-weight:700;color:#001B44;">${s.grand_total||0}</div>
        <div style="font-size:11px;color:#4a5f7a;">Grand Total</div>
      </div>
      <div style="background:#edf0f8;border-radius:8px;padding:12px;border:1.5px solid #001B44;">
        <div style="font-size:20px;font-weight:700;color:#001B44;">${avg}%</div>
        <div style="font-size:11px;color:#4a5f7a;">Average</div>
      </div>
      <div style="background:#edf0f8;border-radius:8px;padding:12px;border:1.5px solid #001B44;">
        <div style="font-size:20px;font-weight:700;color:#16a34a;">✅</div>
        <div style="font-size:11px;color:#4a5f7a;">Authentic</div>
      </div>
    </div>
    <div style="padding:12px 24px 20px;background:#f0fdf4;border-top:1px solid #bbf7d0;border-radius:0 0 12px 12px;text-align:center;font-size:12px;color:#15803d;">
      🔒 This result was retrieved directly from the school's secure database on ${new Date().toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})}. It cannot be altered by anyone outside the school.
    </div>`;
}
handleVerifyParam();

// ══════════════════════════════════════════════════════════
// SECURITY — Disable F12, DevTools, Right Click & Console
// ══════════════════════════════════════════════════════════

// Block F12 and other DevTools shortcuts
document.addEventListener('keydown', function(e){
  // Block F12
  if(e.key === 'F12'){
    e.preventDefault();
    alert('⚠️ Access denied!');
  }
  // Block Ctrl+Shift+I (DevTools)
  if(e.ctrlKey && e.shiftKey && e.key === 'I'){
    e.preventDefault();
    alert('⚠️ Access denied!');
  }
  // Block Ctrl+Shift+J (Console)
  if(e.ctrlKey && e.shiftKey && e.key === 'J'){
    e.preventDefault();
    alert('⚠️ Access denied!');
  }
  // Block Ctrl+U (View Source)
  if(e.ctrlKey && e.key === 'u'){
    e.preventDefault();
    alert('⚠️ Access denied!');
  }
});

// Block Right Click
document.addEventListener('contextmenu', function(e){
  e.preventDefault();
  alert('⚠️ Right click is disabled on this site!');
});

// Disable Console Output
console.log   = function(){};
console.warn  = function(){};
console.error = function(){};
console.info  = function(){};
// ══════════════════════════════════════════════════════════
// SECURITY — Phone & Tablet Protection
// ══════════════════════════════════════════════════════════

// Block view-source:// trick on phone browser
if(window.location.protocol === 'view-source:'){
  window.location.href = 'about:blank';
}

// Block long press (right click equivalent on phone)
document.addEventListener('touchstart', function(e){
  if(e.touches.length > 1){
    e.preventDefault();
  }
}, {passive: false});

// Block context menu on all devices including phone
window.oncontextmenu = function(e){
  e.preventDefault();
  e.stopPropagation();
  return false;
};

// Detect DevTools open on both PC and phone
// Clears page if DevTools detected
setInterval(function(){
  const threshold = 160;
  if(
    window.outerWidth - window.innerWidth > threshold ||
    window.outerHeight - window.innerHeight > threshold
  ){
    document.body.innerHTML =
      '<div style="text-align:center;padding:80px 20px;font-family:sans-serif;">' +
      '<div style="font-size:60px;margin-bottom:20px;">&#9888;&#65039;</div>' +
      '<h1 style="color:#001B44;font-size:24px;">Access Denied</h1>' +
      '<p style="color:#4a5f7a;font-size:15px;">Developer tools are not allowed on this site.</p>' +
      '<p style="color:#4a5f7a;font-size:13px;">Please close developer tools and refresh the page.</p>' +
      '</div>';
  }
}, 1000);

</script>
