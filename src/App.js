import React, { Component } from "react";
import { Resizable } from "re-resizable";
import LineChart from "./line_chart";
import dummy_data from "./data/dummy_data.json";
import "./css/line.css";
var index = 0;
var transition_time = 0;

const MIN_CHART_WIDTH = 1000;
const MIN_CHART_HEIGHT = 600;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: {},
      zoomable: true,
      brushable: true,
      stacked: true,
      cursor_type: "single",
      chartWidth: MIN_CHART_WIDTH,
      chartHeight: MIN_CHART_HEIGHT
    };
  }

  componentDidMount() {
    transition_time = 0;
    this.tick();
    setInterval(() => {
      transition_time = 100000;
      // this.tick.bind(this)();
      this.tick();
    }, 100000);
  }

  tick() {
    console.log("tick");
    this.setState({
      data: dummy_data,
    });
    index += 1;
    if (index > 2) {
      index = 0;
    }
  }

  onResizeStop = (e, direction, ref, d) => {
    console.log('this.state', this)
    this.setState({
      chartWidth: this.state.chartWidth + d.width,
      chartHeight: this.state.chartHeight + d.height,
    });
  }

  render() {
    const { data, zoomable, brushable, stacked, cursor_type } = this.state;
    
    return (
      <div>
        <label>Zoomable</label>
        <input
          type="checkbox"
          name="zoomable"
          checked={zoomable}
          onChange={() => this.setState({ zoomable: !zoomable })}
        />
        <label>Brushable</label>
        <input
          type="checkbox"
          name="brushable"
          checked={brushable}
          onChange={() => this.setState({ brushable: !brushable })}
        />
        <label>Stacked</label>
        <input
          type="checkbox"
          name="stacked"
          checked={stacked}
          onChange={() => this.setState({ stacked: !stacked })}
        />
        Cursor Type:
        <input
          type="radio"
          name="cursor_type"
          value="single"
          checked={cursor_type === "single"}
          onChange={() => this.setState({ cursor_type: "single" })}
        />
        Single
        <input
          type="radio"
          name="cursor_type"
          value="double"
          checked={cursor_type === "double"}
          onChange={() => this.setState({ cursor_type: "double" })}
        />
        Double
        <Resizable
          style={{ border: "1px solid grey" }}
          defaultSize={{
            width: MIN_CHART_WIDTH,
            height: MIN_CHART_HEIGHT
          }}
          minWidth={MIN_CHART_WIDTH}
          minHeight={MIN_CHART_HEIGHT}
          onResizeStop={this.onResizeStop}>
          <LineChart
            chart_data={data}
            width={this.state.chartWidth}
            height={this.state.chartHeight}
            margin={50}
            div_id={"root"}
            brushable={brushable}
            zoomable={zoomable}
            stacked={stacked}
            cursor_type={cursor_type}
          />
        </Resizable>
      </div>
    );
  }
}

export default App;
