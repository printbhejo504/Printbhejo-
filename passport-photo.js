(() => {
  const input=document.getElementById("photoInput"), upload=document.getElementById("uploadPanel"), editor=document.getElementById("editorPanel");
  const preview=document.getElementById("previewCanvas"), sheet=document.getElementById("sheetCanvas"), zoom=document.getElementById("zoomRange");
  const countLabel=document.getElementById("countLabel"); let image=null, count=4, objectUrl=null;
  const PHOTO_W=413, PHOTO_H=531, SHEET_W=2480, SHEET_H=3508; // 35x45mm at 300 DPI

  function drawCrop(canvas,w,h){
    if(!image)return; canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext("2d"); ctx.imageSmoothingQuality="high"; ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h);
    const target=w/h, source=image.width/image.height, z=parseFloat(zoom.value);
    let sw,sh,sx,sy;
    if(source>target){sh=image.height/z; sw=sh*target; sx=(image.width-sw)/2; sy=(image.height-sh)/2}
    else{sw=image.width/z; sh=sw/target; sx=(image.width-sw)/2; sy=(image.height-sh)/2}
    ctx.drawImage(image,sx,sy,sw,sh,0,0,w,h);
  }
  function render(){
    if(!image)return; drawCrop(preview,PHOTO_W,PHOTO_H);
    sheet.width=SHEET_W; sheet.height=SHEET_H; const c=sheet.getContext("2d"); c.fillStyle="#fff"; c.fillRect(0,0,SHEET_W,SHEET_H);
    const gap=70, margin=150; let cols=count===4?2:count===6?3:4, rows=count/cols;
    const maxW=(SHEET_W-2*margin-(cols-1)*gap)/cols, maxH=(SHEET_H-2*margin-(rows-1)*gap)/rows;
    const scale=Math.min(maxW/PHOTO_W,maxH/PHOTO_H), pw=Math.round(PHOTO_W*scale), ph=Math.round(PHOTO_H*scale);
    const totalW=cols*pw+(cols-1)*gap, totalH=rows*ph+(rows-1)*gap, startX=Math.round((SHEET_W-totalW)/2), startY=Math.round((SHEET_H-totalH)/2);
    for(let i=0;i<count;i++){const col=i%cols,row=Math.floor(i/cols),x=startX+col*(pw+gap),y=startY+row*(ph+gap);c.drawImage(preview,x,y,pw,ph)}
    countLabel.textContent=count+" photos";
  }
  input.addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);image=new Image();image.onload=()=>{upload.hidden=true;editor.hidden=false;zoom.value=1;render()};image.src=objectUrl});
  document.querySelectorAll(".count-button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".count-button").forEach(x=>x.classList.remove("active"));b.classList.add("active");count=Number(b.dataset.count);render()}));
  zoom.addEventListener("input",render);
  document.getElementById("changePhoto").onclick=()=>input.click();
  document.getElementById("resetBtn").onclick=()=>{image=null;editor.hidden=true;upload.hidden=false;input.value="";if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null}};
  document.getElementById("downloadBtn").onclick=()=>{if(!image)return;const a=document.createElement("a");a.download="printbhejo-passport-photos-"+count+".jpg";a.href=sheet.toDataURL("image/jpeg",.94);a.click()};
  document.getElementById("printBtn").onclick=()=>{if(!image)return;const url=sheet.toDataURL("image/jpeg",.94),w=window.open("","_blank");if(!w){alert("Please allow pop-ups to print the photo sheet.");return}w.document.write('<html><head><title>PrintBhejo Passport Photos</title><style>@page{size:A4;margin:0}html,body{margin:0;width:210mm;height:297mm}img{width:210mm;height:297mm;display:block}</style></head><body><img src="'+url+'"></body></html>');w.document.close();w.onload=()=>{w.focus();w.print()}};
})();