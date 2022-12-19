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
// import {h, render} from '../../.ignore/eee'

// function App() {
//   const [key, setKey] = useState([3,1,2])
//   return [
//     <button onClick={() => setKey([1,2,3])}>x</button>,
//     <ul>
//       {key.map((i) => (
//         <li key={i}>{i}</li>
//       ))}
//     </ul>,
//   ]
// }

// function App() {
//   const [key, setKey] = useState([1,2,6, 3])
//   return [
//     <button onClick={() => setKey([1,3,5,2,4])}>x</button>,
//     <ul>
//       {key.map((i) => (
//         <li key={i}>{i}</li>
//       ))}
//     </ul>,
//   ]
// }

// function App() {
//   const [key, setKey] = useState(['a', 'b', 'c'])
//   return h(A, null, 222, " items left")
// }

// function App() {
//   const [key, setKey] = useState([1,2,3])
//   return <div>
//     <button onClick={() => setKey([3,1])}>x</button>
//     <ul>
//       {key.map((i) => (
//         <Li i={i} key={i} />
//         // <li key={'#'+i}>{i}</li>
//       ))}
//     </ul>
//   </div>
// }

// function App() {
//   const [list, setList] = useState([1, 2, 3])
//   return <div>{list.map((d) => <span>{d}</span>)} <button onClick={() => setList(list.concat(4))}>+</button></div>
// }

const App = () => {
  let [bool, setbool] = useState(true);
  let [list, setList] = useState([1]);
  console.log("againList", list);
  let ref = useRef({ nowIndex: 0, maxIndex: 1000 });

  useEffect(() => {
    console.log(123);
  }, []);
  const timeSliceSetList = (preList) => {
    const { nowIndex, maxIndex } = ref.current;
    if (nowIndex > maxIndex) return;
    let nowTime = 0;
    let newList = preList || [...list];
    console.log("list:", list);
    while (nowTime < 50) {
      newList.push(nowTime);
      nowTime++;
    }
    ref.current = { nowIndex: nowIndex + nowTime, maxIndex: 1000 };
    setList(newList);
    console.log("afterSetList");
    requestIdleCallback(timeSliceSetList.bind(null, newList));
  };
  return (
    <div>
      {useMemo(
        () => (
          <Header />
        ),
        []
      )}
      {/* css动画小球 */}
      <div class="ball" />
      <button
        onClick={() => {
          // setbool(!bool);
          const list = new Array(1000);
          // setList(new Array(200000).fill(1));
          timeSliceSetList();
        }}
      >
        x
      </button>
      <div style="position:relative;width:100%">
        {list.map(() => (
          <div
            class="circle"
            style="float:left;background:rgba(1,1,1,0.5);width:10px;height:10px"
          />
        ))}
      </div>
    </div>
  );
};

function Header() {
  console.log("Header render");
  return (
    <div>
      <a href="">222</a>
    </div>
  );
}

// function App() {
//   const [key, setKey] = useState([1,2,3,4,5])
//   return (
//     <div>
//       {key.map((i) => (
//         // <Li i={i} key={i} />
//         <li key={i} >{i}</li>
//       ))}
//       <button onClick={() => setKey([5,3,4])}>x</button>
//     </div>
//   )
// }

// export default function App() {
//   const [state, setState] = useState(true);

//   return (
//     <div>
//       <button
//         onClick={() => {
//           setState(false);
//         }}
//       >
//         set
//       </button>
//       {state?<li>111</li>:null}
//     </div>
//   );
// }

// function Li(props) {
//   return <div>
//     <li>{props.i}</li>
//     <li>{props.i}</li>
//   </div>
// }

// function Li(props) {
//   return <li>{props.i}</li>
// }

// const parentNode = document.getElementById("app");

// render(<div><li key={1}>1</li><li key={2}>2</li><li key={3}>3</li></div>, parentNode);

// render(<div><li key={3}>3</li><li key={2}>2</li><li key={1}>1</li></div>, parentNode);

render(<App />, document.getElementById("app"));
