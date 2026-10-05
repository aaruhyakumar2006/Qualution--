import React, { useState } from 'react';
import { 
  Layers, Plus, GripVertical, ChevronUp, ChevronDown, 
  Trash2, Edit, Cpu, BookOpen, CheckSquare, Sparkles, 
  ArrowRight, Users, Play, ShieldAlert 
} from 'lucide-react';
import { initialCourses } from '../data/portalData';

export default function LearningPathBuilderView({ selectedCourse, onNavigate, onSelectStudent }) {
  const currentCourse = selectedCourse || initialCourses[0];
  const [nodes, setNodes] = useState(currentCourse?.phases?.[0]?.nodes?.map(n => ({ ...n, learnersAt: n.learnersAt ?? 0 })) || [
    { id: 'n1', num: '01', title: 'Bits vs Qubits', type: 'THEORY + LAB', badgeColor: 'yellow', duration: '25m', learnersAt: 0 },
    { id: 'n2', num: '02', title: 'Superposition & Hadamard', type: 'THEORY + LAB', badgeColor: 'cyan', duration: '40m', learnersAt: 0 },
    { id: 'n3', num: '03', title: 'Entanglement & Bell States', type: 'THEORY + LAB', badgeColor: 'pink', duration: '50m', learnersAt: 0 },
    { id: 'n4', num: '04', title: 'Measurement Postulates', type: 'THEORY + CHALLENGE', badgeColor: 'lime', duration: '35m', learnersAt: 0 }
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeType, setNewNodeType] = useState('Workbench Lab');

  const nodeTypes = [
    { name: 'Theory', color: 'yellow', icon: BookOpen, desc: 'Conceptual foundations with mathematical formalism' },
    { name: 'Interactive Lesson', color: 'cyan', icon: Sparkles, desc: 'Step-by-step interactive explanation with widgets' },
    { name: 'Workbench Lab', color: 'pink', icon: Cpu, desc: 'Live circuit sandbox with target state validation' },
    { name: 'Challenge', color: 'lime', icon: CheckSquare, desc: 'Constraint-based puzzle with reference solution check' },
    { name: 'Assessment', color: 'purple', icon: Layers, desc: 'Timed multi-question concept evaluation' },
    { name: 'Project', color: 'orange', icon: Play, desc: 'Open-ended quantum algorithm implementation' }
  ];

  const moveNode = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= nodes.length) return;
    const updated = [...nodes];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    // update nums
    updated.forEach((n, i) => {
      n.num = String(i + 1).padStart(2, '0');
    });
    setNodes(updated);
  };

  const handleAddNode = () => {
    if (!newNodeTitle) return;
    const newId = `n-${Date.now()}`;
    const selectedTypeObj = nodeTypes.find(t => t.name === newNodeType) || nodeTypes[0];
    const updated = [
      ...nodes,
      {
        id: newId,
        num: String(nodes.length + 1).padStart(2, '0'),
        title: newNodeTitle,
        type: newNodeType.toUpperCase(),
        badgeColor: selectedTypeObj.color,
        duration: '45m',
        learnersAt: 0
      }
    ];
    setNodes(updated);
    setNewNodeTitle('');
    setShowAddModal(false);
  };

  const removeNode = (id) => {
    const updated = nodes.filter(n => n.id !== id);
    updated.forEach((n, i) => {
      n.num = String(i + 1).padStart(2, '0');
    });
    setNodes(updated);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">UNIFIED LEARNING ARCHITECTURE</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              {currentCourse.title}
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            UNIFIED LEARNING PATH BUILDER
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Curriculum and challenges merged directly into a synchronized game-style progression tree.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => onNavigate('lesson-studio')}
            className="btn-neo btn-neo-white"
          >
            <span>LESSON STUDIO</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-neo btn-neo-yellow"
          >
            <Plus size={18} />
            <span>+ ADD LEARNING NODE</span>
          </button>
        </div>
      </div>

      {/* Mario-Style Pathway Canvas */}
      <div className="path-canvas">
        {/* Phase Header Banner */}
        <div 
          style={{
            background: 'var(--ink)',
            color: 'var(--yellow)',
            padding: '1rem 1.5rem',
            border: 'var(--border-heavy)',
            boxShadow: 'var(--shadow-md)',
            textAlign: 'center',
            marginBottom: '2rem'
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', letterSpacing: '0.15em', fontWeight: 800 }}>
            PHASE 01
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 900, color: '#FFF' }}>
            QUANTUM FOUNDATIONS
          </h2>
          {/* Progression flow labels */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <span className="neo-badge neo-badge-yellow">THEORY</span>
            <span style={{ color: '#888' }}>→</span>
            <span className="neo-badge neo-badge-cyan">INTERACTIVE LAB</span>
            <span style={{ color: '#888' }}>→</span>
            <span className="neo-badge neo-badge-pink">CHALLENGE</span>
            <span style={{ color: '#888' }}>→</span>
            <span className="neo-badge neo-badge-lime">MASTERY</span>
          </div>
        </div>

        {/* Nodes Step Container with Connected Wire Arrows */}
        <div className="path-step-container">
          {nodes.map((node, index) => (
            <React.Fragment key={node.id}>
              {/* Node Card */}
              <div className="path-node-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Reorder Grip */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <button
                      disabled={index === 0}
                      onClick={() => moveNode(index, -1)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      title="Move Node Up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 800 }}>
                      {node.num}
                    </span>
                    <button
                      disabled={index === nodes.length - 1}
                      onClick={() => moveNode(index, 1)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      title="Move Node Down"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>

                  {/* Node Badge Color Pill */}
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      border: '2px solid #000',
                      background: `var(--${node.badgeColor})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '1rem',
                      boxShadow: '2px 2px 0 #000',
                      flexShrink: 0
                    }}
                  >
                    {node.num}
                  </div>

                  {/* Title & Details */}
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{node.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
                      <span className={`neo-badge neo-badge-${node.badgeColor}`}>
                        {node.type}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>
                        Est. {node.duration}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Actions & Live Learner distribution */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Live Student Counter */}
                  <div
                    style={{
                      background: 'var(--paper-tint)',
                      border: '1.5px solid #000',
                      padding: '0.35rem 0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800
                    }}
                    title="Students currently working on this node"
                  >
                    <Users size={14} />
                    <span>{node.learnersAt} Learners</span>
                  </div>

                  {/* Edit in studio */}
                  <button
                    onClick={() => onNavigate('lesson-studio')}
                    className="btn-neo btn-neo-white btn-neo-sm"
                    title="Edit in Lesson Studio"
                  >
                    <Edit size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => removeNode(node.id)}
                    className="btn-neo btn-neo-white btn-neo-sm"
                    title="Remove Node"
                  >
                    <Trash2 size={14} color="var(--crimson)" />
                  </button>
                </div>
              </div>

              {/* Wire Arrow Connector (unless last) */}
              {index < nodes.length - 1 && (
                <div className="path-connector-line" />
              )}
            </React.Fragment>
          ))}

          {/* Wire Arrow to Mastery Node */}
          <div className="path-connector-line" />

          {/* Mastery Milestone Node */}
          <div 
            className="neo-card"
            style={{
              width: '100%',
              background: 'var(--lime)',
              border: 'var(--border-heavy)',
              boxShadow: 'var(--shadow-md)',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  background: '#FFF',
                  border: '2px solid #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '2px 2px 0 #000'
                }}
              >
                ★
              </div>
              <div>
                <span className="neo-badge neo-badge-dark">PHASE COMPLETION</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, marginTop: '0.2rem' }}>
                  PHASE 01 MASTERY VERIFICATION
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => onNavigate('certificates')} className="btn-neo btn-neo-white btn-neo-sm">
                ISSUE CERTIFICATE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Learning Node Modal */}
      {showAddModal && (
        <div className="neo-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="neo-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div style={{ background: 'var(--yellow)', borderBottom: 'var(--border-heavy)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900 }}>+ ADD LEARNING NODE</h3>
              <button onClick={() => setShowAddModal(false)} className="btn-neo btn-neo-white btn-neo-sm">✕</button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>
                  NODE TITLE
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deutsch-Jozsa Oracle Synthesis"
                  className="neo-input"
                  value={newNodeTitle}
                  onChange={(e) => setNewNodeTitle(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.5rem' }}>
                  SELECT NODE TYPE
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  {nodeTypes.map((type) => {
                    const IconComp = type.icon;
                    const isSelected = newNodeType === type.name;
                    return (
                      <div
                        key={type.name}
                        onClick={() => setNewNodeType(type.name)}
                        style={{
                          border: '2px solid #000',
                          background: isSelected ? `var(--${type.color})` : '#FFF',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '3px 3px 0 #000' : '1px 1px 0 #000',
                          transition: 'all 0.1s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.85rem' }}>
                          <IconComp size={16} />
                          <span>{type.name}</span>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)', marginTop: '0.25rem', lineHeight: 1.3 }}>
                          {type.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '2px solid #000', paddingTop: '1rem' }}>
                <button onClick={() => setShowAddModal(false)} className="btn-neo btn-neo-white btn-neo-sm">
                  CANCEL
                </button>
                <button onClick={handleAddNode} className="btn-neo btn-neo-yellow btn-neo-sm">
                  SAVE NODE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
