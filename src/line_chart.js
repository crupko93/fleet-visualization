import React, { Component } from "react";
import * as d3 from "d3";

class LineChart extends Component {
  constructor(props) {
    super(props);
    this.createLineChart = this.createLineChart.bind(this);
    this.updateLineChart = this.updateLineChart.bind(this);
    this.state = {
      default_font: 11,
      rendered: false,
      line_props: {
        current_extents: {},
        x_scale_domain: [],
        y_scale_domains: {},
        highlighted_ranges: {},
        current_x_zoom_level: null,
        current_x_pan: 0,
        current_zoom_chart: "",
        dot_radius: 3,
        cursor_position: 0,
      },
    };
  }

  componentDidMount() {
    this.createLineChart();
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.props.width !== prevProps.width ||
      this.props.height !== prevProps.height) {
      this.createLineChart()
    }

    if (
      this.props.brushable !== prevProps.brushable ||
      this.props.brushable !== prevProps.brushable ||
      this.props.zoomable !== prevProps.zoomable ||
      this.props.stacked !== prevProps.stacked ||
      this.props.cursor_type !== prevProps.cursor_type
    ) {
      this.setState(
        {
          line_props: { ...this.state.line_props, current_extents: {} },
        },
        this.updateLineChart
      );
    } else if (
      JSON.stringify(prevState.line_props) !==
      JSON.stringify(this.state.line_props)
    ) {
      return;
    } else if (Object.keys(this.props.chart_data).length > 0) {
      this.updateLineChart();
    }
  }

  updateLineChart() {
    const svg = d3.select(this.node);
    const my_class = this.props.div_id;
    const {
      chart_data,
      brushable,
      zoomable,
      stacked,
      cursor_type,
    } = this.props;
    var width = +svg.attr("width");
    var height = +svg.attr("height");
    var margin = { left: 100, right: 30, top: 60, bottom: 105 };
    if (this.props.brushable === false) {
      margin = { left: 100, right: 50, top: 60, bottom: 85 };
    }
    var double_to_single = false;

    var my_chart = this.line_chart()
      .width(width - margin.left - margin.right)
      .height(height - margin.top - margin.bottom)
      .start_x(margin.left)
      .start_y(margin.top)
      .line_data(chart_data.line_charts)
      .my_class(my_class)
      .x_title(chart_data.x_axis_title)
      .my_title(chart_data.title)
      .is_brushable(brushable)
      .is_zoomable(zoomable)
      .is_stacked(stacked)
      .cursor_type(cursor_type)
      .double_to_single(double_to_single);

    my_chart(d3.select(this.node));
  }

  line_chart() {
    //REUSABLE line chart
    let line_props = { ...this.state.line_props };
    let currentComponent = this;

    var width = 0,
      height = 0,
      start_x = 0,
      start_y = 0,
      line_data = [],
      my_class = "",
      my_title = "",
      x_title = "",
      is_brushable = true,
      is_zoomable = true,
      is_stacked = true,
      double_to_single = false,
      my_colours = {},
      y_formats = {},
      axis_y_formats = {},
      y_titles = {},
      y_scales = {},
      y_scales_all = {},
      y_brushes = {},
      cursor_brushes = {},
      zoom = {},
      cursor_type = "",
      chart_gap = 20,
      brush_width = 30,
      cursor_values = {},
      from_zoomed = false;

    function my(svg) {
      //define chart height and extra dimensions
      var chart_height =
        (height - (line_data.length - 1) * chart_gap) / line_data.length;
      var chart_down = chart_height;
      var axis_left = 0;
      var mouseover_left = 0;
      var mouseover_bottom = 0;
      if (is_stacked === false) {
        //if no stacking, set extra dimensions and rest height, chart_height, width and start_x
        axis_left = 50;
        mouseover_left = 33;
        mouseover_bottom = 15;
        start_x += (line_data.length - 1) * axis_left;
        height -= line_data.length * 15;
        chart_height = height;
        chart_down = 0;
        chart_gap = 0;
        width = width - axis_left * line_data.length;
      }
      if (is_stacked === true) {
        //if no stacking, set extra dimensions and rest height, chart_height, width and start_x
        axis_left = 50;
        mouseover_left = 33;
        mouseover_bottom = 15;
        start_x += (line_data.length - 1) * axis_left;
        //height -= line_data.length * 15;
        chart_height = height;
        chart_down = 0;
        chart_gap = 0;
        width = width - axis_left * line_data.length;

      }
      //loop through data and define colours, y_formats and y_scales
      line_data.forEach(function (d, i) {
        my_colours[i] = d.colour;
        y_formats[i] = d3.format(d.y_format);
        y_titles[i] = d.y_title;
        axis_y_formats[i] = d3.format(d.axis_y_format);
        var y_max = d3.max(d.data, (m) => +m.data_value);
        var y_min = d3.min(d.data, (m) => +m.data_value);
        console.log('y_max', y_max, y_min)

        if (is_stacked === true) {
          if (y_max > 1) {
            y_min = 0 - y_max
          } else {
            y_max = y_max * 2
          }
        }

        if (y_min > 0) {
          y_min = 0;
        }
        y_scales[i] = d3
          .scaleLinear()
          .domain([y_min, y_max])
          .range([
            chart_height - line_props.dot_radius * 2,
            line_props.dot_radius,
          ]);
        y_scales_all[i] = d3
          .scaleLinear()
          .domain([y_min, y_max])
          .range([
            chart_height - line_props.dot_radius * 2,
            line_props.dot_radius,
          ]);
      });

      //set x_format and scales
      var percent_format = d3.format(".1%");
      var x_format = d3.timeFormat("%d %b");
      var x_extent = d3.extent(
        line_data[0].data,
        (d) => new Date(d.timestamp_recorded)
      );
      var x_extra = line_props.dot_radius * 2;
      var x_scale = d3
        .scaleTime()
        .domain(x_extent)
        .range([line_props.dot_radius, width - x_extra]);
      var x_scale_all = d3
        .scaleTime()
        .domain(x_extent)
        .range([line_props.dot_radius, width - x_extra]);

      //this section checks whether the latest data is within the current extent or not
      if (line_props.current_extents.x_min === undefined) {
        //sets domains and extents as first time around
        line_props.current_extents = {
          x_min: x_extent[0],
          x_max: x_extent[1],
          y_min: get_y_extent(0),
          y_max: get_y_extent(1),
        };
        line_props.x_scale_domain = x_extent;
        line_data.forEach(function (d, i) {
          line_props.highlighted_ranges[i] = x_extent;
          line_props.y_scale_domains[i] = y_scales_all[i].domain();
        });
        reset_line_props_state();
      } else if (
        x_extent[0] < line_props.current_extents.x_min ||
        x_extent[1] > line_props.current_extents.x_max
      ) {
        //resetting as out of bounds
        line_props.current_extents = {
          x_min: x_extent[0],
          x_max: x_extent[1],
          y_min: get_y_extent(0),
          y_max: get_y_extent(1),
        };
        line_props.x_scale_domain = x_extent;
        line_props.cursor_position = 0;
        reset_line_props_state();

        line_data.forEach(function (d, i) {
          line_props.highlighted_ranges[i] = x_extent;
          line_props.y_scale_domains[i] = [get_y_extent(0), get_y_extent(1)];
        });
        reset_line_props_state();
      } else {
        //keeping current
        x_scale.domain(line_props.x_scale_domain);
        line_data.forEach(function (d, i) {
          y_scales[i].domain(line_props.y_scale_domains[i]);
        });
      }

      //now define brushes and zoom
      var x_brush = d3
        .brushX()
        .extent([
          [x_extra / 2, 0],
          [width - x_extra / 2, brush_width],
        ])
        .on("brush end", brushed_x);

      line_data.forEach(function (d, i) {
        y_brushes[i] = d3
          .brushY()
          .extent([
            [0, x_extra / 2],
            [brush_width, chart_height - x_extra / 2],
          ])
          .on("brush end", brushed_y);

        cursor_brushes[i] = d3
          .brushX()
          .extent([
            [x_extra / 2, 0],
            [width - x_extra / 2, chart_height - x_extra / 2],
          ])
          .on("brush end", cursor_brushed);

        zoom[i] = d3
          .zoom()
          .scaleExtent([1, 6])
          .translateExtent([
            [0, 0],
            [width, chart_height],
          ])
          .extent([
            [0, 0],
            [width, chart_height],
          ])
          .on("zoom", zoomed);
      });

      //axis definitions
      var x_axis_all = d3.axisBottom(x_scale_all).tickSizeOuter(0);
      var x_axis = d3.axisBottom(x_scale).tickSizeOuter(0);

      function y_axis(my_index) {
        var my_format = axis_y_formats[my_index];
        return d3
          .axisLeft(y_scales[my_index])
          .tickSizeOuter(0)
          /*.tickFormat((d) =>
            is_stacked === false
              ? ""
              : y_scales_all[my_index].domain()[0] === 0
                ? d > 0
                  ? my_format(d)
                  : ""
                : my_format(d)
          );*/
          .tickFormat('')

      }

      function y_axis_all(my_index) {
        var my_format = axis_y_formats[my_index];
        return d3
          .axisLeft(y_scales_all[my_index])
          .tickSizeOuter(0)
          .tickFormat((d) =>
            y_scales_all[my_index].domain()[0] === 0
              ? d > 0
                ? my_format(d)
                : ""
              : my_format(d)
          );
      }

      //append non-data dependent elements (if first time)
      if (d3.select(".x_axis" + my_class)._groups[0][0] === null) {
        svg.append("text").attr("class", "title title" + my_class);
        svg
          .append("text")
          .attr("class", "cursor_values cursor_values" + my_class);
        svg.append("g").attr("class", "axis x_axis" + my_class);
        svg.append("g").attr("class", "axis_all x_axis_all" + my_class);
        svg
          .append("text")
          .attr("class", "mouseover_text mouseover_text" + my_class);
        svg.append("text").attr("class", "axis_title x_title" + my_class);
        svg.append("g").attr("class", "normal_brush x_brush" + my_class);
        svg
          .append("defs")
          .append("clipPath")
          .attr("id", "clip")
          .append("rect")
          .attr("class", "clip_rect" + my_class);
        svg
          .append("defs")
          .append("clipPath")
          .attr("id", "clip_x_axis")
          .append("rect")
          .attr("class", "clip_rect_x_axis" + my_class);
        svg
          .append("defs")
          .append("clipPath")
          .attr("id", "clip_y_axis")
          .append("rect")
          .attr("class", "clip_rect_y_axis" + my_class);

        line_data.forEach(function (d, i) {
          svg.append("g").attr("class", "y_axis axis y_axis" + my_class + i);
          svg.append("g").attr("class", "axis_all y_axis_all" + my_class + i);
          svg.append("text").attr("class", "axis_title y_title" + my_class + i);
          svg.append("g").attr("class", "normal_brush y_brush" + my_class + i);
          svg
            .append("line")
            .attr(
              "class",
              "mouseover_item" +
              my_class +
              " mouseover_path x_mouseover" +
              my_class +
              i
            );
          svg
            .append("line")
            .attr(
              "class",
              "mouseover_item" +
              my_class +
              " mouseover_path y_mouseover" +
              my_class +
              i
            );
          svg
            .append("rect")
            .attr(
              "class",
              "mouseover_item" +
              my_class +
              " mouseover_rect y_mouseover_rect" +
              my_class +
              i
            );
          svg
            .append("text")
            .attr(
              "class",
              "mouseover_item" +
              my_class +
              " mouseover_text y_mouseover_text" +
              my_class +
              i
            );
          svg
            .append("rect")
            .attr(
              "class",
              "mouseover_item" +
              my_class +
              " mouseover_rect x_mouseover_rect" +
              my_class +
              i
            );
          svg
            .append("text")
            .attr(
              "class",
              "mouseover_item" +
              my_class +
              " mouseover_text x_mouseover_text" +
              my_class +
              i
            );
          svg
            .append("rect")
            .attr("class", "zoom_rect zoom_rect" + my_class + i);
          svg.append("g").attr("class", "axis_grid y_axis_grid" + my_class + i);
          svg.append("g").attr("class", "axis_grid x_axis_grid" + my_class + i);
          svg
            .append("g")
            .attr("class", "cursor_brush double_cursor_brush" + my_class + i);
          svg
            .append("text")
            .attr(
              "class",
              "cursor_text cursor_text_left cursor_text_left" +
              my_class +
              i +
              " cursor_text" +
              my_class +
              i
            );
          svg
            .append("text")
            .attr(
              "class",
              "cursor_text cursor_text_right cursor_text_right" +
              my_class +
              i +
              " cursor_text" +
              my_class +
              i
            );
          svg
            .append("text")
            .attr(
              "class",
              "cursor_text cursor_text_middle cursor_text_middle" +
              my_class +
              i +
              " cursor_text" +
              my_class +
              i
            );
        });
        svg
          .append("rect")
          .attr("class", "cursor_rect cursor_rect_1" + my_class);
      }
      //set non-data dep properties in order

      d3.select(".title" + my_class)
        .attr("y", -20)
        .text(my_title)
        .attr("transform", "translate(" + start_x + "," + start_y + ")");

      d3.select(".cursor_values" + my_class)
        .attr("x", width)
        .attr("y", -20)
        .text("")
        .attr("transform", "translate(" + start_x + "," + start_y + ")");

      d3.select(".x_axis" + my_class)
        .call(x_axis)
        .attr(
          "transform",
          "translate(" + start_x + "," + (start_y + height + 1) + ")"
        );

      if (is_brushable === true) {
        d3.select(".x_axis_all" + my_class)
          .attr("display", "block")
          .call(x_axis_all)
          .attr(
            "transform",
            "translate(" +
            start_x +
            "," +
            (start_y +
              height +
              20 +
              (line_data.length - 1) * mouseover_bottom) +
            ")"
          );
      } else {
        d3.select(".x_axis_all" + my_class).attr("display", "none");
      }

      d3.select(".mouseover_text" + my_class)
        .attr("y", -20)
        .attr(
          "transform",
          "translate(" + (start_x + width) + "," + start_y + ")"
        );

      d3.select(".x_title" + my_class)
        .attr("x", width / 2)
        .text(x_title)
        .attr(
          "transform",
          "translate(" +
          start_x +
          "," +
          (start_y + (is_brushable === true ? 64 : 40) + height) +
          ")"
        );

      d3.select(".clip_rect" + my_class)
        .attr("width", width)
        .attr("height", chart_height);

      d3.select(".clip_rect_x_axis" + my_class)
        .attr("width", width)
        .attr("height", chart_height)
        .attr("transform", "translate(0," + -chart_height + ")");

      d3.select(".clip_rect_y_axis" + my_class)
        .attr("width", 60)
        .attr("height", chart_height)
        .attr("transform", "translate(" + -60 + ",0)");

      //set visibility depending on selected cursor type
      if (cursor_type === "single") {
        d3.select(".cursor_rect_1" + my_class)
          .style("display", "block")
          .attr("height", height)
          .attr("transform", "translate(" + start_x + "," + start_y + ")");

        d3.selectAll(".cursor_text").style("display", "none");
      } else if (cursor_type === "double") {
        d3.select(".cursor_rect_1" + my_class)
          .attr("x", 0)
          .style("display", "none");
        line_props.cursor_position = 0;
        reset_line_props_state();

        d3.selectAll(".cursor_text").style("display", "block").text("");
      }

      line_data.forEach(function (d, i) {
        i = +i;
        var transform_y = start_y + i * (chart_down + chart_gap);

        d3.select(".x_axis_grid" + my_class + i)
          .attr("clip-path", "url('#clip_x_axis')")
          .call(x_axis)
          .attr(
            "transform",
            "translate(" + start_x + "," + (transform_y + chart_height) + ")"
          );

        d3.selectAll(".x_axis_grid" + my_class + i + " .tick line")
          .attr("y1", -chart_height)
          .attr("y2", 0);

        d3.select(".x_mouseover_rect" + my_class + i)
          .attr("y", chart_height + i * (chart_down + chart_gap))
          .attr("height", 15)
          .attr("width", 60)
          .attr(
            "transform",
            "translate(" +
            start_x +
            "," +
            (start_y + line_props.dot_radius + i * mouseover_bottom) +
            ")"
          );

        d3.select(".x_mouseover" + my_class + i);

        d3.select(".y_mouseover" + my_class + i);

        d3.select(".x_mouseover_text" + my_class + i)
          .style("fill", my_colours[i])
          .attr("y", chart_height + 15 + i * (chart_down + chart_gap))
          .attr(
            "transform",
            "translate(" +
            start_x +
            "," +
            (start_y + i * mouseover_bottom) +
            ")"
          );

        d3.select(".y_mouseover_rect" + my_class + i)
          .attr("x", -30)
          .attr("height", 15)
          .attr("width", 35)
          .attr(
            "transform",
            "translate(" +
            (start_x -
              mouseover_left -
              i * axis_left -
              line_props.dot_radius) +
            "," +
            (transform_y - 15 / 2) +
            ")"
          );

        d3.select(".y_mouseover_text" + my_class + i)
          .style("fill", my_colours[i])
          .attr("x", -(31 / 2))
          .attr("dy", 4)
          .attr(
            "transform",
            "translate(" +
            (start_x - mouseover_left - i * axis_left) +
            "," +
            transform_y +
            ")"
          );

        //brushable
        d3.select(".y_title" + my_class + i)
          .attr("fill", is_stacked === false ? my_colours[i] : "#333333")
          .text(y_titles[i])
          .attr(
            "transform",
            "translate(" +
            (start_x -
              8 -
              brush_width -
              (is_brushable === true ? 30 : is_stacked === false ? 30 : 0) -
              +i * axis_left) +
            "," +
            (transform_y + chart_height / 2) +
            ") rotate(-90)"
          );

        d3.select(".y_axis" + my_class + i)
          .call(y_axis(i))
          .attr(
            "transform",
            "translate(" + (start_x - 1) + "," + transform_y + ")"
          );

        if (
          is_brushable === true ||
          (is_stacked === true && is_brushable === false)
        ) {
          d3.select(".y_axis_all" + my_class + i)
            .attr("display", "block")
            .call(y_axis_all(i))
            .attr(
              "transform",
              "translate(" +
              (start_x - 38 - i * axis_left) +
              "," +
              transform_y +
              ")"
            );
        } else {
          if (is_stacked === true) {
            d3.select(".y_axis_all" + my_class + i).attr("display", "none");
          } else {
            d3.select(".y_axis_all" + my_class + i).attr("display", "block");
          }
        }

        d3.select(".y_axis_grid" + my_class + i)
          .attr("clip-path", "url('#clip')")
          .call(y_axis(i))
          .attr("transform", "translate(" + start_x + "," + transform_y + ")");

        d3.selectAll(".y_axis" + my_class + i + " .tick text").attr(
          "text-anchor",
          "middle"
        );

        d3.selectAll(".y_axis_all" + my_class + i + " .tick text")
          .attr("text-anchor", "middle")
          .attr("x", -10);

        d3.selectAll(".y_axis_grid" + my_class + i + " .tick line")
          .attr("x1", 0)
          .attr("x2", width);

        if (cursor_type === "double") {
          var x_range = [
            x_scale_all(line_props.highlighted_ranges[i][0]),
            x_scale_all(line_props.highlighted_ranges[i][1]),
          ];

          if (+i === 0 || (i > 0 && is_stacked === true)) {
            d3.select(".double_cursor_brush" + my_class + i)
              .attr("id", "cursorbrush_" + i)
              .attr("display", "block")
              .attr(
                "transform",
                "translate(" + start_x + "," + transform_y + ")"
              )
              .call(cursor_brushes[i])
              .call(cursor_brushes[i].move, x_range);

            d3.selectAll(".cursor_text" + my_class + i).attr(
              "transform",
              "translate(" + start_x + "," + (transform_y - 2) + ")"
            );
          } else {
            d3.select(".double_cursor_brush" + my_class + i)
              .attr("display", "block")
              .attr("display", "none");
          }
        } else {
          d3.select(".cursor_brush" + my_class).attr("display", "none");

          d3.select(".double_cursor_brush" + my_class + i)
            .attr("display", "none")
            .on(".brush", null)
            .on(".end", null);
        }

        var y_range = [
          y_scales_all[i](line_props.y_scale_domains[i][1]),
          y_scales_all[i](line_props.y_scale_domains[i][0]),
        ];

        d3.select(".y_brush" + my_class + i)
          .attr("display", "block")
          .attr("id", "brushy_" + i)
          .attr(
            "transform",
            "translate(" +
            (start_x - 63 - i * axis_left) +
            "," +
            transform_y +
            ")"
          )
          .call(y_brushes[i])
          .call(y_brushes[i].move, y_range);

        if (is_brushable === true) {
          d3.selectAll(".y_brush" + my_class + i + " .handle").attr(
            "display",
            "block"
          );
        } else {
          if (is_stacked === true) {
            d3.select(".y_brush" + my_class + i).attr("display", "none");
          } else {
            d3.select(".y_brush" + my_class + i).attr("display", "block");

            d3.selectAll(".y_brush" + my_class + i + " .handle").attr(
              "display",
              "none"
            );
          }
          d3.select(".y_brush" + my_class + i)
            .on(".brush", null)
            .on(".end", null);
        }

        d3.selectAll(".y_brush" + my_class + i + " .selection").style(
          "fill",
          is_stacked === true ? "#A0A0A0" : my_colours[i]
        );

        if (is_zoomable === true) {
          d3.select(".zoom_rect" + my_class + i)
            .attr(
              "visibility",
              is_stacked === true ? "visible" : +i > 0 ? "hidden" : "visible"
            )
            .attr("id", "zoomrect_" + i)
            .attr("width", width)
            .attr("height", chart_height)
            .attr("transform", "translate(" + start_x + "," + transform_y + ")")
            .call(zoom[i])
            .on("dblclick.zoom", null);
        } else {
          d3.select(".zoom_rect" + my_class + i)
            .attr(
              "visibility",
              is_stacked === true ? "visible" : +i > 0 ? "hidden" : "visible"
            )
            .attr("id", "zoomrect_" + i)
            .attr("width", width)
            .attr("height", chart_height)
            .attr("transform", "translate(" + start_x + "," + transform_y + ")")
            .on(".zoom", null);
        }
      });

      d3.select(".cursor_rect_1" + my_class)
        .on("mouseover", function () {
          d3.select(this).attr("cursor", "grab");
        })
        .call(
          d3
            .drag()
            .on("start", function () {
              d3.select(this).attr("cursor", "grabbing");
            })
            .on("drag end", function () {
              var my_x = d3.event.sourceEvent.offsetX - start_x - 4;
              if (my_x < 0) {
                my_x = 0;
              }
              if (my_x > x_scale_all.range()[1]) {
                my_x = x_scale_all.range()[1];
              }
              if (cursor_type === "single") {
                d3.select(this).attr("x", my_x);
                line_props.cursor_position = my_x;
                reset_line_props_state();
                // find nearest from drag
                find_nearest_point(my_x, my_class);
              }
            })
        );

      if (is_brushable === true) {
        var x_range = [
          x_scale_all(line_props.x_scale_domain[0]),
          x_scale_all(line_props.x_scale_domain[1]),
        ];

        d3.select(".x_brush" + my_class)
          .attr("display", "block")
          .attr(
            "transform",
            "translate(" +
            start_x +
            "," +
            (start_y +
              height +
              21 +
              (line_data.length - 1) * mouseover_bottom) +
            ")"
          )
          .call(x_brush)
          .call(x_brush.move, x_range);
      } else {
        d3.select(".x_brush" + my_class)
          .attr("display", "none")
          .on("brush", null)
          .on("end", null);
      }

      //now data dependent elements (only 1 this time)
      var my_group = svg
        .selectAll(".line_group")
        .data(line_data)
        .join(function (group) {
          var enter = group.append("g").attr("class", "line_group");
          enter
            .append("path")
            .attr("class", "line_path line_path" + my_class)
            .attr("clip-path", "url('#clip')");
          enter.append("g").attr("class", "dot_group" + my_class);
          return enter;
        });

      //line path
      my_group
        .select(".line_path" + my_class)
        .attr("id", (d, i) => "line_path" + my_class + i)
        .attr("fill", "none")
        .attr("stroke", (d, i) => my_colours[i])
        .attr("d", (d, i) =>
          d3
            .line()
            .x((f) => x_scale(new Date(f.timestamp_recorded)))
            .y((f) => y_scales[i](f.data_value))(d.data)
        )
        .attr(
          "transform",
          (d, i) =>
            "translate(" +
            start_x +
            "," +
            (start_y + +i * (chart_down + chart_gap)) +
            ")"
        );

      my_group.select(".dot_group" + my_class).attr("id", (d, i) => "dc_" + i);

      var dot_group = my_group
        .select(".dot_group" + my_class)
        .selectAll(".dot_group")
        .data((d) => d.data)
        .join(function (group) {
          var enter = group.append("g").attr("class", "dot_group");
          enter
            .append("circle")
            .attr("class", "dot_circle" + my_class)
            .attr("clip-path", "url('#clip')");
          return enter;
        });

      dot_group
        .select(".dot_circle" + my_class)
        .attr("r", function () {
          if (d3.select(this).attr("r") === null) {
            return line_props.dot_radius;
          } else {
            return d3.select(this).attr("r");
          }
        })
        .attr("cx", (d) => x_scale(new Date(d.timestamp_recorded)))
        .attr("cy", function (d) {
          d.parent_index = +this.parentElement.parentElement.id.split("_")[1];
          return y_scales[d.parent_index](d.data_value);
        })
        .attr("id", (d, i) => "dot_" + d.parent_index + "_" + i)
        .attr("fill", (d) => my_colours[d.parent_index])
        .attr(
          "transform",
          (d) =>
            "translate(" +
            start_x +
            "," +
            (start_y + d.parent_index * (chart_down + chart_gap)) +
            ")"
        )
        .attr("class", function (d) {
          return (
            "dot_circle" + my_class + " dot_circle" + my_class + d.parent_index
          );
        });

      d3.selectAll(".cursor_rect").raise();
      d3.selectAll(".cursor_brush").raise();

      if (cursor_type === "single") {
        find_nearest_point(line_props.cursor_position, my_class);
        if (double_to_single === true) {
          d3.selectAll(".dot_circle" + my_class).attr(
            "r",
            line_props.dot_radius
          );
        }
      }

      function reset_line_props_state() {
        if (
          JSON.stringify(line_props) !==
          JSON.stringify(currentComponent.state.line_props)
        ) {
          currentComponent.setState({
            line_props,
          });
        }
      }

      function cursor_brushed() {
        if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom")
          return; // ignore brush-by-zoom
        if (cursor_type === "single") return; //don't brush if single cursor
        var s = d3.event.selection || x_scale_all.range();
        var highlighted_range = s.map(x_scale.invert, x_scale);
        if (is_stacked === true) {
          var my_id = this.id.split("_")[1];
          reset_double_cursor(my_id, highlighted_range);
        } else {
          line_data.forEach(function (d, i) {
            reset_double_cursor(i, highlighted_range);
          });
        }
      }

      function reset_double_cursor(my_id, highlighted_range) {
        line_props.highlighted_ranges[my_id] = highlighted_range;
        reset_line_props_state();
        var current_data = line_data[my_id].data;
        var got_first = false,
          first_dot = -1,
          last_dot = -1,
          first_value = "",
          last_value = "";

        d3.selectAll(".dot_circle" + my_class + my_id).attr(
          "r",
          line_props.dot_radius
        );

        current_data.forEach(function (d, i) {
          if (
            new Date(d.timestamp_recorded) >= highlighted_range[0] &&
            got_first === false
          ) {
            first_dot = +i;
            first_value = d.data_value;
            got_first = true;
          } else if (new Date(d.timestamp_recorded) <= highlighted_range[1]) {
            last_dot = +i;
            last_value = d.data_value;
          }
        });

        if (first_dot > last_dot) {
          d3.selectAll(".cursor_text").text("");
        } else {
          if (cursor_values[y_titles[my_id]] === undefined) {
            cursor_values[y_titles[my_id]] = {};
          }
          cursor_values[y_titles[my_id]]["start"] = y_formats[my_id](
            first_value
          );
          cursor_values[y_titles[my_id]]["middle"] = percent_format(
            (last_value - first_value) / first_value
          );
          cursor_values[y_titles[my_id]]["end"] = y_formats[my_id](last_value);

          d3.select(".cursor_text_left" + my_class + my_id)
            .attr("y", 12)
            .attr("x", x_scale(highlighted_range[0]) + 5)
            .text(x_format(highlighted_range[0]));

          d3.select(".cursor_text_middle" + my_class + my_id)
            .attr(
              "x",
              x_scale(highlighted_range[0]) +
              (x_scale(highlighted_range[1]) -
                x_scale(highlighted_range[0])) /
              2
            )
            .text(
              d3.timeDay.count(highlighted_range[0], highlighted_range[1]) +
              " days"
            );

          d3.select(".cursor_text_right" + my_class + my_id)
            .attr("x", x_scale(highlighted_range[1]) - 5)
            .attr("y", chart_height)
            .text(x_format(highlighted_range[1]));

          d3.selectAll("#dot_" + my_id + "_" + first_dot).attr(
            "r",
            line_props.dot_radius * 2
          );

          d3.selectAll("#dot_" + my_id + "_" + last_dot).attr(
            "r",
            line_props.dot_radius * 2
          );
        }
        var values_text = "";
        var c = 0;
        for (c in cursor_values) {
          values_text +=
            c +
            ": from " +
            cursor_values[c].start +
            " to " +
            cursor_values[c].end +
            " - " +
            cursor_values[c].middle +
            " change ";
        }
        d3.select(".cursor_values" + my_class).text(values_text);
      }

      function brushed_x() {
        if (d3.event.sourceEvent === null)
          return;
        if (d3.event.sourceEvent.type === "zoom")
          return; // ignore brush-by-zoom
        var s = d3.event.selection || x_scale_all.range();
        if (s[0] < 0) {
          s[0] = 0;
        }
        if (s[1] < 0) {
          s[1] = 0;
        }
        x_scale.domain(s.map(x_scale_all.invert, x_scale_all));
        line_props.x_scale_domain = x_scale.domain();
        reset_line_props_state();
        reset_x();
        if (is_zoomable === true) {
          if (from_zoomed === false) {
            if (d3.event.sourceEvent !== null) {
              // find nearest from brush x - only triggers is brush is handled (ie not at start or from zoom)
              find_nearest_point(line_props.cursor_position, my_class);
            }
          }
          line_data.forEach(function (d, i) {
            svg
              .select(".zoom_rect" + my_class + i)
              .call(
                zoom[i].transform,
                d3.zoomIdentity.scale(width / (s[1] - s[0])).translate(-s[0], 0)
              );
          });
        }
      }

      function brushed_y() {
        if (d3.event.sourceEvent === null)
          return;
        if (d3.event.sourceEvent.type === "zoom")
          return; // ignore brush-by-zoom
        var my_id = this.id.split("_")[1];
        var s = d3.event.selection || y_scales_all[my_id].range();
        if (s[0] < 0) {
          s[0] = 0;
        }
        if (s[1] < 0) {
          s[1] = 0;
        }
        y_scales[my_id].domain(
          s.map(y_scales_all[my_id].invert, y_scales_all[my_id]).reverse()
        );
        line_props.y_scale_domains[my_id] = y_scales[my_id].domain();
        reset_y(+my_id);
        reset_line_props_state();
        if (is_zoomable === true) {
          if (from_zoomed === false) {
            if (d3.event.sourceEvent !== null) {
              //  find nearest from brush y - only triggers when brush is handled - ie not from start or zoom
              find_nearest_point(line_props.cursor_position, my_class);
            }
          }
          svg
            .select(".zoom_rect" + my_class + my_id)
            .call(
              zoom[+my_id].transform,
              d3.zoomIdentity
                .scale(chart_height / (s[1] - s[0]))
                .translate(0, -s[0])
            );
        }
      }

      function zoomed() {
        console.log('line_props', line_props);
        var y_id = +this.id.split("_")[1];
        var t = d3.event.transform;
        if (
          d3.event.sourceEvent.type === "wheel" ||
          d3.event.sourceEvent.type === "mousemove"
        ) {
          //set y scale first as always scales to charts zoom level
          y_scales[y_id].domain(t.rescaleY(y_scales_all[y_id]).domain());
          line_props.y_scale_domains[y_id] = y_scales[y_id].domain();
          Object.keys(y_scales).forEach(function (d) {
            reset_y(d);
          });
          // var gap_x = d3.timeMillisecond.count(x_scale_all.domain()[0],x_scale_all.domain()[1]);
          // var gap_x_all = d3.timeMillisecond.count(x_scale.domain()[0],x_scale.domain()[1])
          if (line_props.current_extents.current_zoom_chart === undefined) {
            line_props.current_extents.current_zoom_chart = y_id;
          }
          if (y_id !== line_props.current_extents.current_zoom_chart) {
            t.k = line_props.current_extents.current_x_zoom_level;
            t.x = line_props.current_extents.current_x_pan;
            line_props.current_extents.current_zoom_chart = y_id;
          } else {
            if (Math.abs(t.x - line_props.current_extents.current_x_pan) > 400) {
              //fix to stop jump if switching between zoom rectangles and
              //mouse is on the opposite side of the brush position
              t.x = line_props.current_extents.current_x_pan;
            }
            line_props.current_extents.current_x_zoom_level = t.k;
            line_props.current_extents.current_x_pan = t.x;
            line_props.current_extents.current_zoom_chart = y_id;
          }
          x_scale.domain(t.rescaleX(x_scale_all).domain());
          line_props.x_scale_domain = x_scale.domain();
          reset_x();
          line_props.current_extents.current_x_zoom_level = t.k;
          line_props.current_extents.current_x_pan = t.x;
          reset_line_props_state();
          if (is_brushable === true) {
            from_zoomed = true;
            //changed this so that the brush is moving to the right place
            svg
              .select(".x_brush" + my_class)
              .call(x_brush.move, x_scale.range().map(t.invertX, t));
            var reverse_y_scale = y_scales[y_id].range().reverse();
            svg
              .select(".y_brush" + my_class + y_id)
              .call(y_brushes[y_id].move, reverse_y_scale.map(t.invertY, t));
            from_zoomed = false;
          }
          // find nearest from zoomed
          find_nearest_point(line_props.cursor_position, my_class);
        }
      }

      function reset_x() {
        d3.selectAll(".line_path" + my_class).attr("d", (d, i) =>
          d3
            .line()
            .x((f) => x_scale(new Date(f.timestamp_recorded)))
            .y((f) => y_scales[i](f.data_value))(d.data)
        );

        d3.selectAll(".dot_circle" + my_class).attr("cx", (d) =>
          x_scale(new Date(d.timestamp_recorded))
        );

        d3.select(".x_axis" + my_class).call(x_axis);

        d3.selectAll(".x_axis" + my_class + " .tick text").attr("y", 3);

        line_data.forEach(function (d, i) {
          if (d3.select("#cursorbrush_" + i).node() !== null) {
            var x_range = [
              x_scale_all(line_props.highlighted_ranges[i][0]),
              x_scale_all(line_props.highlighted_ranges[i][1]),
            ];
            d3.select("#cursorbrush_" + i).call(
              cursor_brushes[i].move,
              x_range
            );
          }
          d3.select(".x_axis_grid" + my_class + i).call(
            d3
              .axisBottom(x_scale)
              .tickSizeOuter(0)
              .tickValues(x_scale_all.ticks())
          );

          d3.selectAll(".x_axis_grid" + my_class + i + " .tick line")
            .attr("y1", -chart_height)
            .attr("y2", 0);
        });
      }

      function reset_y(my_id) {
        d3.select(".y_axis" + my_class + my_id).call(y_axis(my_id));

        d3.selectAll(".dot_circle" + my_class + my_id).attr("cy", (d) =>
          y_scales[my_id](d.data_value)
        );

        d3.selectAll(".y_axis" + my_class + my_id + " .tick text")
          .attr("text-anchor", "middle")
          .attr("x", -10)
          .attr("y", 0);

        d3.selectAll("#line_path" + my_class + my_id).attr("d", (d) =>
          d3
            .line()
            .x((f) => x_scale(new Date(f.timestamp_recorded)))
            .y((f) => y_scales[my_id](f.data_value))(d.data)
        );

        d3.select(".y_axis_grid" + my_class + my_id).call(y_axis(my_id));

        d3.selectAll(".y_axis_grid" + my_class + my_id + " .tick line")
          .attr("x1", 0)
          .attr("x2", width);
      }

      function find_nearest_point(my_x, my_class) {
        d3.selectAll(".mouseover_item" + my_class)
          .interrupt()
          .style("visibility", "hidden");
        d3.selectAll(".dot_circle" + my_class)
          .interrupt()
          .attr("r", line_props.dot_radius);
        var nearest = "";
        //keeping for loop here due to break
        for (var l in line_data) {
          var found_dot = false;
          var current_domain = y_scales[l].domain();
          var current_data = line_data[l].data;
          current_data = current_data.filter(
            (f) =>
              f.data_value >= current_domain[0] &&
              f.data_value <= current_domain[1]
          );
          for (var i in current_data) {
            if (x_scale(new Date(current_data[i].timestamp_recorded)) > my_x) {
              nearest = current_data[+i - 1];
              if (nearest !== undefined) {
                reset_mouseover_items(nearest, l, +i - 1);
              }
              found_dot = true;
              break;
            }
          }
          if (found_dot === false) {
            nearest = current_data[+i];
            if (nearest !== undefined) {
              reset_mouseover_items(nearest, l, +i);
            }
          }
        }
      }

      function reset_mouseover_items(nearest, line_index, data_index) {
        var transform_y = start_y + line_index * (chart_down + chart_gap);
        var nearest_date = new Date(nearest.timestamp_recorded);

        d3.selectAll(".dot_circle" + my_class).each(function (d) {
          var dot_line_index = this.id.split("_")[1];
          if (line_index === dot_line_index) {
            if (
              d3.timeSecond.count(
                nearest_date,
                new Date(d.timestamp_recorded)
              ) === 0
            ) {
              d3.select(this).attr("r", line_props.dot_radius * 1.5);
            }
          }
        });
        //position x_mouseover_ rect
        d3.select(".x_mouseover" + my_class + line_index)
          .attr("clip-path", "url('#clip')")
          .attr("x1", x_scale(nearest_date) - line_props.dot_radius)
          .attr("x2", x_scale(nearest_date) - line_props.dot_radius * 1.5 - 0.5)
          .attr("y1", y_scales[line_index](nearest.data_value))
          .attr("y2", y_scales[line_index](nearest.data_value))
          .attr("transform", "translate(" + start_x + "," + transform_y + ")")
          .style("visibility", "visible")
          .style("stroke", my_colours[line_index])
          .transition()
          .duration(150)
          .attr("x1", Math.max(x_scale(0), 0));

        d3.select(".x_mouseover_rect" + my_class + line_index)
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("x", x_scale(nearest_date) - 25);

        //and axis text
        d3.select(".x_mouseover_text" + my_class + line_index)
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("x", x_scale(nearest_date))
          .text(x_format(nearest_date));

        d3.select(".y_mouseover" + my_class + line_index)
          .attr("clip-path", "url('#clip')")
          .attr("x1", x_scale(nearest_date))
          .attr("x2", x_scale(nearest_date))
          .attr(
            "y1",
            y_scales[line_index](nearest.data_value) + line_props.dot_radius
          )
          .attr(
            "y2",
            y_scales[line_index](nearest.data_value) +
            line_props.dot_radius * 1.5 +
            0.5
          )
          .attr("transform", "translate(" + start_x + "," + transform_y + ")")
          .style("visibility", "visible")
          .style("stroke", my_colours[line_index])
          .transition()
          .duration(150)
          .attr(
            "y1",
            Math.min(y_scales[line_index](0), height) + line_props.dot_radius
          );

        d3.select(".y_mouseover_rect" + my_class + line_index)
          .attr("clip-path", "url('#clip_y_axis')")
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("y", y_scales[line_index](nearest.data_value));

        d3.select(".y_mouseover_text" + my_class + line_index)
          .attr("clip-path", "url('#clip_y_axis')")
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("y", y_scales[line_index](nearest.data_value))
          .text(y_formats[line_index](nearest.data_value));
      }
      function get_y_extent(extent_index) {
        var my_value = 0;

        for (let y in y_scales_all) {
          var my_extent = y_scales_all[y].domain()[extent_index];
          if (+y === 0) {
            my_value = my_extent;
          } else {
            if (extent_index === 0) {
              if (my_extent < my_value) {
                my_value = my_extent;
              }
            } else {
              if (my_extent > my_value) {
                my_value = my_extent;
              }
            }
          }
        }
        return my_value;
      }
    }

    my.width = function (value) {
      if (!arguments.length) return width;
      width = value;
      return my;
    };

    my.height = function (value) {
      if (!arguments.length) return height;
      height = value;
      return my;
    };

    my.start_x = function (value) {
      if (!arguments.length) return start_x;
      start_x = value;
      return my;
    };

    my.start_y = function (value) {
      if (!arguments.length) return start_y;
      start_y = value;
      return my;
    };

    my.line_data = function (value) {
      if (!arguments.length) return line_data;
      line_data = value;
      return my;
    };

    my.my_class = function (value) {
      if (!arguments.length) return my_class;
      my_class = value;
      return my;
    };

    my.my_title = function (value) {
      if (!arguments.length) return my_title;
      my_title = value;
      return my;
    };

    my.x_title = function (value) {
      if (!arguments.length) return x_title;
      x_title = value;
      return my;
    };

    my.is_brushable = function (value) {
      if (!arguments.length) return is_brushable;
      is_brushable = value;
      return my;
    };

    my.is_zoomable = function (value) {
      if (!arguments.length) return is_zoomable;
      is_zoomable = value;
      return my;
    };

    my.cursor_type = function (value) {
      if (!arguments.length) return cursor_type;
      cursor_type = value;
      return my;
    };

    my.is_stacked = function (value) {
      if (!arguments.length) return is_stacked;
      is_stacked = value;
      return my;
    };

    my.double_to_single = function (value) {
      if (!arguments.length) return double_to_single;
      double_to_single = value;
      return my;
    };

    return my;
  }

  createLineChart() {
    //set current node, width, height and margins and svg size
    const node = this.node;

    d3.select(node)
      .attr("width", this.props.width)
      .attr("height", this.props.height);
  }
  render() {
    return (
      <svg
        ref={(node) => (this.node = node)}
        className={this.props.className}
      />
    );
  }
}
export default LineChart;
