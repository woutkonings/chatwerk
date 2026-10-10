# Reference track: dark hypnotic techno

A hand-made track that shows what the app can sound like with the right sounds and production techniques. Every layer passes the app validator, so the agent can make the same kind of music. It is a reference for people, not an example for the system prompt.

[Open in strudel.cc](https://strudel.cc/#c2V0Y3BtKDEzMi80KQpraWNrOiBzKCJiZCo0IikuYmFuaygiUm9sYW5kVFI5MDkiKS5nYWluKC45NSkuc2hhcGUoLjIpLmR1Y2tvcmJpdCgyKS5kdWNrYXR0YWNrKC4xNikuZHVja2RlcHRoKC45KS5tYXNrKCI8MSEyOCAwITQ%2BIikKYmFzczogbm90ZSgiW34gYTEgYTEgYTFdKjQiKS5zKCJzYXd0b290aCIpLnZlbG9jaXR5KCJbMCAxIC44IC45XSo0IikubHBmKHNpbmUucmFuZ2UoMTgwLCA1MjApLnNsb3coMTYpKS5scHEoNikuZGVjYXkoLjE0KS5zdXN0YWluKDApLnNoYXBlKC4yNSkuZ2FpbiguNzUpLm9yYml0KDIpLm1hc2soIjwxITI4IDAhND4iKQpoYXRzOiBzKCJoaCoxNiIpLmJhbmsoIlJvbGFuZFRSOTA5IikudmVsb2NpdHkoIlsuNiAuOSAuNyAxXSo0IikuZ2FpbiguMykuaHBmKDQwMDApLmN1dCgxKS5wYW4oc2luZS5yYW5nZSguNCwgLjYpLnNsb3coNCkpLmRlZ3JhZGVCeSguMDgpLm1hc2soIjwwITQgMSEyOD4iKQpvcGVuaGF0OiBzKCJbfiBvaF0qNCIpLmJhbmsoIlJvbGFuZFRSOTA5IikuZ2FpbiguMjgpLmhwZig1MDAwKS5jdXQoMSkubWFzaygiPDAhNCAxITI4PiIpCmNsYXA6IHMoIn4gY3AgfiBjcCIpLmJhbmsoIlJvbGFuZFRSOTA5IikuZ2FpbiguNDUpLnJvb20oLjM1KS5yb29tc2l6ZSgzKS5tYXNrKCI8MCE4IDEhMjAgMCE0PiIpCnBlcmM6IHMoInJpbSg1LDE2LDMpIikuYmFuaygiUm9sYW5kVFI5MDkiKS5nYWluKC4zMikuZGVsYXkoLjQ1KS5kZWxheXRpbWUoMy8xNikuZGVsYXlmZWVkYmFjayguNikucGFuKHNpbmUuc2xvdyg3KSkub3JiaXQoMykKc3RhYjogY2hvcmQoIjxBbTkhMyBEbTk%2BIikuc3RydWN0KCJbfiB%2BIHggfl0gfiBbfiB4IH4gfl0gfiIpLnZvaWNpbmcoKS5zKCJzYXd0b290aCIpLmxwZihzaW5lLnJhbmdlKDYwMCwgMTYwMCkuc2xvdygzMikpLmRlY2F5KC4xOCkuc3VzdGFpbigwKS5nYWluKC4yOCkuZGVsYXkoLjYpLmRlbGF5dGltZSgzLzE2KS5kZWxheWZlZWRiYWNrKC42KS5yb29tKC41KS5yb29tc2l6ZSg2KS5vcmJpdCgzKS5tYXNrKCI8MCE4IDEhMjQ%2BIikKYWNpZDogbm90ZSgiW2ExIGEyIGExIGMyIGExIGcyIGExIGUyXSoyIikucygic2F3dG9vdGgiKS5scGYoc2luZS5yYW5nZSgyNTAsIDE4MDApLnNsb3coMjQpKS5scHEoMTYpLmxwZW52KDMpLmxwZGVjYXkoLjEyKS5kZWNheSguMTUpLnN1c3RhaW4oLjMpLnNoYXBlKC4zKS5nYWluKC40Mikuc29tZXRpbWVzQnkoLjE1LCB4ID0%2BIHgudHJhbnNwb3NlKDEyKSkuZGVsYXkoLjI1KS5kZWxheXRpbWUoMy8xNikuZGVsYXlmZWVkYmFjayguMzUpLm9yYml0KDApLm1hc2soIjwwITE2IDEhMTIgMCE0PiIp)

```js
setcpm(132/4)
kick: s("bd*4").bank("RolandTR909").gain(.95).shape(.2).duckorbit(2).duckattack(.16).duckdepth(.9).mask("<1!28 0!4>")
bass: note("[~ a1 a1 a1]*4").s("sawtooth").velocity("[0 1 .8 .9]*4").lpf(sine.range(180, 520).slow(16)).lpq(6).decay(.14).sustain(0).shape(.25).gain(.75).orbit(2).mask("<1!28 0!4>")
hats: s("hh*16").bank("RolandTR909").velocity("[.6 .9 .7 1]*4").gain(.3).hpf(4000).cut(1).pan(sine.range(.4, .6).slow(4)).degradeBy(.08).mask("<0!4 1!28>")
openhat: s("[~ oh]*4").bank("RolandTR909").gain(.28).hpf(5000).cut(1).mask("<0!4 1!28>")
clap: s("~ cp ~ cp").bank("RolandTR909").gain(.45).room(.35).roomsize(3).mask("<0!8 1!20 0!4>")
perc: s("rim(5,16,3)").bank("RolandTR909").gain(.32).delay(.45).delaytime(3/16).delayfeedback(.6).pan(sine.slow(7)).orbit(3)
stab: chord("<Am9!3 Dm9>").struct("[~ ~ x ~] ~ [~ x ~ ~] ~").voicing().s("sawtooth").lpf(sine.range(600, 1600).slow(32)).decay(.18).sustain(0).gain(.28).delay(.6).delaytime(3/16).delayfeedback(.6).room(.5).roomsize(6).orbit(3).mask("<0!8 1!24>")
acid: note("[a1 a2 a1 c2 a1 g2 a1 e2]*2").s("sawtooth").lpf(sine.range(250, 1800).slow(24)).lpq(16).lpenv(3).lpdecay(.12).decay(.15).sustain(.3).shape(.3).gain(.42).sometimesBy(.15, x => x.transpose(12)).delay(.25).delaytime(3/16).delayfeedback(.35).orbit(0).mask("<0!16 1!12 0!4>")
```

## Techniques

1. **Drum machine samples.** TR-909 kick, hats, open hat, clap and rim, not synth drums.
2. **Sidechain.** The kick ducks the bass bus (`duckorbit(2)`), so the bass pumps with the kick.
3. **Rolling bass.** Three 16th notes after each kick (`[~ a1 a1 a1]`), short envelope, and a filter that opens and closes over 16 bars.
4. **Dub bus (orbit 3).** A euclidean rim pattern and an Am9 to Dm9 chord stab share a dotted-8th delay (`3/16`) with feedback and a reverb.
5. **Acid line.** Resonant sawtooth with a filter envelope, a slow cutoff sweep over 24 bars and random octave jumps.
6. **Groove details.** Hat velocity accents, 8% random hat drop-outs, slow panning, and the closed hat cuts the open hat (`cut(1)`).
7. **Arrangement in one 32-bar loop** (with `mask`):

| Bars | What plays |
|---|---|
| 1 to 4 | kick, bass, rim |
| 5 to 8 | hats come in |
| 9 to 16 | clap and dub stab come in |
| 17 to 28 | acid line (the peak) |
| 29 to 32 | breakdown: no kick, bass, clap or acid. Then the loop starts again with the drop |

Not verified by ear: the checks prove that the code builds and that the arrangement timing is right. The mix levels can need small changes.
