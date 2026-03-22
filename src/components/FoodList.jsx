import { C } from '../utils/colors.js';
import FoodCategory from './FoodCategory.jsx';

export default function FoodList({ search, setSearch, filteredDB, selections, openCat, setOpenCat, expandedId, toggleFood, updateMult, inp }) {
  return (
    <>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input type="text" placeholder={"\ud83d\udd0d  Rechercher un aliment ou un plat..."} aria-label="Rechercher un aliment" value={search} onChange={e => setSearch(e.target.value)} style={inp} />
        {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>{"\u00d7"}</button>}
      </div>
      {Object.entries(filteredDB).map(([cat, foods]) => (
        <FoodCategory
          key={cat}
          cat={cat}
          foods={foods}
          selections={selections}
          openCat={openCat}
          setOpenCat={setOpenCat}
          search={search}
          expandedId={expandedId}
          toggleFood={toggleFood}
          updateMult={updateMult}
        />
      ))}
    </>
  );
}
