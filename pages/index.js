import { useEffect, useRef, useState } from 'react'

export default function Home(){
  const canvasRef = useRef(null)      // offscreen virtual canvas (320x240)
  const visibleRef = useRef(null)     // visible canvas inside monitor
  const screenRef = useRef(null)
  const [started, setStarted] = useState(false)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const stateRef = useRef({})

  useEffect(() => {
    stateRef.current = {
      player: { x:146, y:200, w:28, h:10, speed:3, left:false, right:false },
      playerBullets: [],
      alienBullets: [],
      aliens: [],
      alienDir: 1,
      lastShot: 0,
      tick: 0
    }

    const onKeyDown = (e) => {
      // prevent space scrolling
      if (e.code === 'Space') e.preventDefault()
      const st = stateRef.current
      if (e.code === 'ArrowLeft') st.player.left = true
      if (e.code === 'ArrowRight') st.player.right = true
      if (e.code === 'Space' && started && !gameOver) {
        const now = performance.now()
        if (now - st.lastShot > 160) {
          st.playerBullets.push({ x: st.player.x + st.player.w/2 -2, y: st.player.y - 8, w:4, h:8, dy:-6 })
          st.lastShot = now
        }
      }
      // R to restart
      if ((e.key === 'r' || e.key === 'R') && gameOver) {
        handleRestart()
      }
    }
    const onKeyUp = (e) => {
      const st = stateRef.current
      if (e.code === 'ArrowLeft') st.player.left = false
      if (e.code === 'ArrowRight') st.player.right = false
    }

    window.addEventListener('keydown', onKeyDown, {passive:false})
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [started, gameOver])

  useEffect(() => {
    let raf
    const loop = () => {
      step()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  function handleStart(){
    const st = stateRef.current
    st.playerBullets = []
    st.alienBullets = []
    st.aliens = []
    st.alienDir = 1
    st.tick = 0
    setScore(0)
    setGameOver(false)
    setStarted(true)
    // spawn aliens
    for (let r=0;r<3;r++){
      for (let c=0;c<8;c++){
        st.aliens.push({ x:12 + c*36, y:12 + r*22, w:20, h:12, alive:true })
      }
    }
    st.player.x = 146
    // focus visible canvas for better mobile behavior
    setTimeout(()=>{ visibleRef.current && visibleRef.current.focus() }, 100)
  }

  function handleRestart(){
    setStarted(false)
    setTimeout(()=> handleStart(), 80)
  }

  function step(){
    const canvas = canvasRef.current
    const v = visibleRef.current
    if (!canvas || !v) return
    const ctx = canvas.getContext('2d')
    const st = stateRef.current
    const V_W = 320, V_H = 240
    if (canvas.width !== V_W || canvas.height !== V_H) {
      canvas.width = V_W; canvas.height = V_H
    }
    // clear
    ctx.fillStyle = 'black'
    ctx.fillRect(0,0,V_W,V_H)

    // HUD
    ctx.fillStyle = '#7CFC00'
    ctx.font = '10px monospace'
    ctx.fillText('INTAKE WINDOW ACTIVE', 8, 12)
    ctx.fillText('PRESELECTED SUBJECTS: DEFEND', 8, 24)
    ctx.fillText('SCORE: ' + String(score).padStart(4,'0'), 220, 12)

    if (!started) {
      ctx.font = '12px monospace'
      ctx.fillText('PRESS PLAY TO BEGIN', 100, 120)
      renderToVisible()
      return
    }

    // player movement
    if (st.player.left) st.player.x -= st.player.speed
    if (st.player.right) st.player.x += st.player.speed
    st.player.x = Math.max(6, Math.min(V_W - st.player.w - 6, st.player.x))

    // draw player
    ctx.fillStyle = '#7CFC00'
    ctx.fillRect(st.player.x, st.player.y, st.player.w, st.player.h)
    ctx.fillRect(st.player.x + st.player.w/2 -1, st.player.y - 4, 2, 4)

    // player bullets
    for (let i=st.playerBullets.length-1;i>=0;i--){
      const b = st.playerBullets[i]
      b.y += b.dy
      ctx.fillRect(b.x, b.y, b.w, b.h)
      if (b.y + b.h < 0) st.playerBullets.splice(i,1)
    }

    // aliens movement
    st.tick++
    if (st.tick % 30 === 0) {
      let minX=Infinity, maxX=-Infinity
      st.aliens.forEach(a => { if (a.alive) { minX = Math.min(minX,a.x); maxX = Math.max(maxX,a.x) } })
      if (minX === Infinity) {
        for (let r=0;r<3;r++){
          for (let c=0;c<8;c++){
            st.aliens.push({ x:12 + c*36, y:12 + r*22, w:20, h:12, alive:true })
          }
        }
        st.alienDir *= 1.05
      } else {
        if (maxX + st.alienDir*8 > V_W - 16 || minX + st.alienDir*8 < 16) {
          st.aliens.forEach(a => { a.y += 12 })
          st.alienDir *= -1
        } else {
          st.aliens.forEach(a => { a.x += st.alienDir*8 })
        }
      }
    }

    // draw aliens
    ctx.fillStyle = '#00FF66'
    for (let a of st.aliens) {
      if (!a.alive) continue
      if (a.y + a.h >= st.player.y) {
        setGameOver(true); setStarted(false); break
      }
      ctx.fillRect(a.x, a.y, a.w, a.h)
      ctx.clearRect(a.x+4, a.y+2, a.w-8, a.h-6)
    }

    // collisions
    for (let i=st.playerBullets.length-1;i>=0;i--){
      const b = st.playerBullets[i]
      for (let j=0;j<st.aliens.length;j++){
        const a = st.aliens[j]
        if (!a.alive) continue
        if (b.x < a.x + a.w && b.x + b.w > a.x && b.y < a.y + a.h && b.y + b.h > a.y) {
          a.alive = false
          st.playerBullets.splice(i,1)
          setScore(s=>s+10)
          break
        }
      }
    }

    // alien bullets occasionally
    if (Math.random() < 0.012) {
      const alive = st.aliens.filter(x=>x.alive)
      if (alive.length) {
        const shooter = alive[Math.floor(Math.random()*alive.length)]
        st.alienBullets.push({ x: shooter.x + shooter.w/2 -2, y: shooter.y + shooter.h +2, w:4, h:8, dy:4 })
      }
    }

    // alien bullets draw
    ctx.fillStyle = '#FF6A6A'
    for (let i=st.alienBullets.length-1;i>=0;i--){
      const b = st.alienBullets[i]
      b.y += b.dy
      ctx.fillRect(b.x, b.y, b.w, b.h)
      if (b.y + b.h >= st.player.y && b.x < st.player.x + st.player.w && b.x + b.w > st.player.x) {
        setGameOver(true); setStarted(false)
      }
      if (b.y > V_H) st.alienBullets.splice(i,1)
    }

    // CRT scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.06)'
    for (let y=0;y<V_H;y+=2) ctx.fillRect(0,y,V_W,1)

    if (gameOver) {
      ctx.fillStyle = '#FF5555'
      ctx.font = '14px monospace'
      ctx.fillText('SUBJECT OBSERVED', 86, 110)
      ctx.fillStyle = '#7CFC00'
      ctx.fillText('SCORE: ' + String(score).padStart(4,'0'), 120, 135)
    }

    renderToVisible()
  }

  function renderToVisible(){
    const canvas = canvasRef.current
    const v = visibleRef.current
    const screen = screenRef.current
    if (!canvas || !v || !screen) return
    const rect = screen.getBoundingClientRect()
    v.width = Math.max(8, Math.floor(rect.width))
    v.height = Math.max(8, Math.floor(rect.height))
    const ctxS = v.getContext('2d')
    ctxS.imageSmoothingEnabled = false
    ctxS.clearRect(0,0,v.width,v.height)
    ctxS.drawImage(canvas, 0, 0, v.width, v.height)
  }

  useEffect(() => {
    const onResize = () => renderToVisible()
    window.addEventListener('resize', onResize)
    setTimeout(()=>renderToVisible(), 200)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="page-root">
      <div className="monitor-wrap">
        <img src="/monitor.png" className="monitor-image" alt="monitor" />
        <div id="monitor-screen" ref={screenRef} className="monitor-screen" aria-hidden="true">
          <canvas ref={visibleRef} className="visible" tabIndex={0}></canvas>

          {/* Button UI: K1-B (bottom-center) */}
          {!started && !gameOver && (
            <button className="arcade-btn play-btn" onClick={handleStart}>PLAY</button>
          )}

          {gameOver && (
            <button className="arcade-btn play-btn" onClick={handleRestart}>PLAY AGAIN</button>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} style={{display:'none'}}></canvas>

      <div className="credits">
        <p>Use ← → to move — SPACE to shoot. Click PLAY to start. Press R to restart.</p>
      </div>
    </div>
  )
}
