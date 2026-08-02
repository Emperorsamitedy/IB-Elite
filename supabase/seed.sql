-- =============================================================
-- Seed / demo questions — original practice questions written for
-- this platform. The syllabus tree lives in seed_syllabus.sql.
-- Safe to re-run: skips prompts that already exist.
-- =============================================================

-- ---------- questions ----------
-- Helper insert: resolve subject_id/topic_id via slugs.
insert into public.questions
  (subject_id, topic_id, level_id, prompt, answer, solution, difficulty, marks, question_type, calculator, source, license, status)
select
  s.id, tp.id,
  (select l.id from public.levels l where l.subject_id = s.id and l.code = q.level_code),
  q.prompt, q.answer, q.solution, q.difficulty::difficulty, q.marks, q.qtype, q.calc,
  'Seed/demo (original)', 'CC BY-NC 4.0 (platform original)', 'published'
from (values
  -- math-aa · number & algebra
  ('math-aa','sequences-series','HL','easy',3,'short-answer',false,
   'The first term of an arithmetic sequence is 7 and the common difference is 4. Find the 20th term.',
   '83','u20 = 7 + (20-1)(4) = 7 + 76 = 83.'),
  ('math-aa','sequences-series','SL','medium',5,'short-answer',false,
   'An arithmetic series has first term 3 and 10th term 30. Find the sum of the first 10 terms.',
   '165','d = (30-3)/9 = 3. S10 = 10/2 (3 + 30) = 5 × 33 = 165.'),
  ('math-aa','exponents-logarithms','HL','medium',4,'short-answer',false,
   'Solve for x: log_2(x) + log_2(x - 2) = 3.',
   'x = 4','log_2(x(x-2)) = 3 ⇒ x^2 - 2x = 8 ⇒ x^2 - 2x - 8 = 0 ⇒ (x-4)(x+2)=0. x>2 so x = 4.'),
  ('math-aa','binomial-theorem','HL','hard',6,'short-answer',false,
   'Find the term independent of x in the expansion of (2x - 1/x^2)^9.',
   '-5376','General term C(9,r)(2x)^(9-r)(-x^-2)^r has x-power 9 - 3r = 0 ⇒ r = 3. Coefficient = C(9,3)·2^6·(-1)^3 = 84·64·(-1) = -5376.'),
  ('math-aa','exponents-logarithms','SL','easy',2,'short-answer',false,
   'Evaluate log_3(81).',
   '4','3^4 = 81, so log_3(81) = 4.'),
  -- math-aa · functions
  ('math-aa','linear-quadratic','SL','easy',3,'short-answer',false,
   'Find the coordinates of the vertex of f(x) = x^2 - 6x + 5.',
   '(3, -4)','x = -b/2a = 3, f(3) = 9 - 18 + 5 = -4. Vertex (3, -4).'),
  ('math-aa','function-properties','HL','medium',5,'short-answer',false,
   'Given f(x) = 2x + 1 and g(x) = x^2, find (f ∘ g)(x) and (g ∘ f)(x).',
   '2x^2 + 1 and (2x+1)^2','(f∘g)(x) = 2x^2 + 1. (g∘f)(x) = (2x+1)^2 = 4x^2 + 4x + 1.'),
  ('math-aa','function-properties','HL','hard',6,'short-answer',false,
   'The function f(x) = (3x - 1)/(x + 2). Find f^{-1}(x) and state its domain.',
   'f^{-1}(x) = (2x + 1)/(3 - x), x ≠ 3','Let y = (3x-1)/(x+2). Solve: xy + 2y = 3x - 1 ⇒ x(y-3) = -1 - 2y ⇒ x = (2y+1)/(3-y). Swap: f^{-1}(x) = (2x+1)/(3-x), x ≠ 3.'),
  ('math-aa','transformations','SL','medium',4,'short-answer',false,
   'The graph of y = x^2 is transformed to y = (x - 3)^2 + 2. Describe the transformation.',
   'Translation 3 right and 2 up','Horizontal shift right 3, vertical shift up 2: vector (3, 2).'),
  -- math-aa · geometry & trig
  ('math-aa','triangle-trigonometry','SL','medium',4,'short-answer',false,
   'In triangle ABC, a = 8, b = 5 and angle C = 60°. Find the length of side c.',
   'c = 7','c^2 = 64 + 25 - 2(8)(5)cos60° = 89 - 40 = 49, c = 7.'),
  ('math-aa','trigonometric-identities','HL','medium',5,'short-answer',false,
   'Solve 2sin(x) = 1 for 0 ≤ x ≤ 2π.',
   'x = π/6 or x = 5π/6','sin x = 1/2 ⇒ x = π/6, 5π/6 in the given range.'),
  ('math-aa','vectors','HL','hard',6,'short-answer',false,
   'Given vectors a = (2, -1, 3) and b = (1, 4, -2), find the angle between them to the nearest degree.',
   '≈ 94°','a·b = 2 - 4 - 6 = -8. |a| = √14, |b| = √21. cosθ = -8/√294 ≈ -0.4666 ⇒ θ ≈ 94°.'),
  ('math-aa','circular-functions','SL','easy',2,'short-answer',false,
   'State the exact value of cos(30°).',
   '√3 / 2','cos 30° = √3/2.'),
  -- math-aa · statistics & probability
  ('math-aa','probability','SL','medium',4,'short-answer',true,
   'A bag has 4 red and 6 blue marbles. Two are drawn without replacement. Find P(both red).',
   '2/15','(4/10)(3/9) = 12/90 = 2/15.'),
  ('math-aa','distributions','HL','medium',5,'short-answer',true,
   'X ~ B(10, 0.3). Find P(X = 3) to 3 s.f.',
   '0.267','C(10,3)(0.3)^3(0.7)^7 = 120 × 0.027 × 0.0823543 ≈ 0.267.'),
  ('math-aa','probability','HL','hard',6,'short-answer',true,
   'Events A and B satisfy P(A) = 0.6, P(B) = 0.5, P(A ∪ B) = 0.8. Are A and B independent? Justify.',
   'Yes','P(A ∩ B) = 0.6 + 0.5 - 0.8 = 0.3. Independence needs P(A)·P(B) = 0.6 × 0.5 = 0.30, which equals P(A ∩ B), so A and B are independent.'),
  -- math-aa · calculus
  ('math-aa','differentiation','SL','easy',3,'short-answer',false,
   'Differentiate f(x) = 3x^4 - 2x^2 + 7.',
   '12x^3 - 4x','Power rule term by term: 12x^3 - 4x.'),
  ('math-aa','applications-of-derivatives','HL','medium',5,'short-answer',false,
   'Find the equation of the tangent to y = x^2 at the point (3, 9).',
   'y = 6x - 9','dy/dx = 2x = 6 at x = 3. y - 9 = 6(x - 3) ⇒ y = 6x - 9.'),
  ('math-aa','integration','HL','hard',7,'long-answer',false,
   'Evaluate the definite integral of (2x + 1) from x = 0 to x = 3.',
   '12','∫(2x+1)dx = x^2 + x. Evaluated 0→3: (9 + 3) - 0 = 12.'),
  ('math-aa','applications-of-derivatives','SL','medium',4,'short-answer',false,
   'Find the x-coordinate of the stationary point of f(x) = x^2 - 8x + 1.',
   'x = 4','f''(x) = 2x - 8 = 0 ⇒ x = 4.'),
  -- physics
  ('physics','kinematics','SL','easy',3,'short-answer',true,
   'A car accelerates uniformly from rest to 20 m/s in 8 s. Find its acceleration.',
   '2.5 m/s^2','a = Δv/Δt = 20/8 = 2.5 m/s^2.'),
  ('physics','momentum-impulse','HL','medium',5,'short-answer',true,
   'A 2 kg object moving at 3 m/s collides and sticks to a 1 kg object at rest. Find the common velocity after collision.',
   '2 m/s','Momentum: 2×3 = (2+1)v ⇒ v = 6/3 = 2 m/s.'),
  ('physics','electric-fields','HL','hard',6,'long-answer',true,
   'Two point charges of +3 μC and -3 μC are 0.2 m apart. Find the magnitude of the force between them. (k = 8.99×10^9)',
   '≈ 2.02 N','F = k q1 q2 / r^2 = 8.99e9 × (3e-6)^2 / 0.04 ≈ 2.02 N (attractive).'),
  ('physics','wave-model','SL','medium',4,'short-answer',true,
   'A wave has frequency 50 Hz and wavelength 6 m. Find its speed.',
   '300 m/s','v = fλ = 50 × 6 = 300 m/s.'),
  -- chemistry
  ('chemistry','counting-particles-by-mass','SL','easy',3,'short-answer',true,
   'How many moles are in 36 g of water (H2O, M = 18 g/mol)?',
   '2 mol','n = m/M = 36/18 = 2 mol.'),
  ('chemistry','covalent-model','HL','medium',4,'multiple-choice',false,
   'Which type of intermolecular force is primarily responsible for the high boiling point of water?',
   'Hydrogen bonding','Water molecules form hydrogen bonds due to O-H bonds and lone pairs on oxygen.'),
  ('chemistry','energy-from-fuels','HL','hard',6,'long-answer',true,
   'The combustion of methane releases 890 kJ/mol. Calculate the energy released when 8 g of methane (M = 16) is burned.',
   '445 kJ','n = 8/16 = 0.5 mol. Energy = 0.5 × 890 = 445 kJ.'),
  -- biology
  ('biology','cells-form-function','SL','easy',2,'multiple-choice',false,
   'Which organelle is the primary site of aerobic respiration in eukaryotic cells?',
   'Mitochondrion','The mitochondrion is where the Krebs cycle and oxidative phosphorylation occur.'),
  ('biology','organisms-continuity','HL','medium',4,'short-answer',false,
   'A heterozygous tall plant (Tt) is crossed with a short plant (tt). What fraction of offspring are expected to be short?',
   '1/2','Tt × tt → 1 Tt : 1 tt ⇒ half short.'),
  ('biology','organisms-form-function','SL','medium',4,'short-answer',false,
   'Name the process by which oxygen moves from the alveoli into the blood.',
   'Diffusion','Oxygen diffuses down its concentration gradient across the alveolar membrane.'),
  -- economics
  ('economics','elasticity','SL','medium',4,'long-answer',false,
   'Explain what is meant by price elasticity of demand and state one determinant of it.',
   'Responsiveness of quantity demanded to a price change; e.g. availability of substitutes',
   'PED = %ΔQd / %ΔP. Determinants include substitutes, necessity vs luxury, and time.'),
  ('economics','macro-objectives','HL','medium',5,'long-answer',false,
   'Distinguish between demand-pull and cost-push inflation.',
   'Demand-pull: excess AD; cost-push: rising costs of production',
   'Demand-pull arises from AD exceeding potential output; cost-push from higher input costs shifting SRAS left.'),
  ('economics','exchange-rates','HL','hard',6,'long-answer',false,
   'Explain how a depreciation of a country''s currency can affect its balance of trade.',
   'Exports cheaper, imports dearer — trade balance may improve (Marshall-Lerner)',
   'Depreciation lowers export prices abroad and raises import prices, improving the trade balance if the Marshall-Lerner condition holds.')
) as q(subject_slug, topic_slug, level_code, difficulty, marks, qtype, calc, prompt, answer, solution)
join public.subjects s on s.slug = q.subject_slug
join public.topics tp on tp.subject_id = s.id and tp.slug = q.topic_slug
where not exists (
  select 1 from public.questions ex
  where ex.topic_id = tp.id and ex.prompt = q.prompt
);
