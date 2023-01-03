import {
    h,
    render,
    useEffect,
    useState,
    useRef,
    useCallback,
    useMemo,
  } from "../../src/index";
  import "./index.css";
  
  const App = () => {
    let [count, setCount] = useState(0);
    console.log('======',count);

    return (
      <div>
        {/* css动画小球 */}
        <button onClick={()=>{
            setCount((pre)=>pre+1);
            setCount((pre)=>pre+1);
        }}>{count}</button>
      </div>
    );
  };
  
  
  render(<App />, document.getElementById("app"));
  