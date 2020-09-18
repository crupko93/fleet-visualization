import * as d3 from "d3";
import React from 'react';
var line_props = {};


export function draw_line(svg, my_data, my_class, current_line_props) {

  line_props = current_line_props;

  var width = +svg.attr("width");
  var height = +svg.attr("height");
  var margin = { left: 100, right: 30, top: 60, bottom: 105 };
  if (my_data.is_brushable === false) {
    margin = { left: 100, right: 50, top: 60, bottom: 85 };
  }
  check_status(["zoomable","brushable","stacked","cursor_type"],my_data)

  var my_chart = line_chart()
    .width(width - margin.left - margin.right)
    .height(height - margin.top - margin.bottom)
    .start_x(margin.left)
    .start_y(margin.top)
    .line_data(my_data.line_charts)
    .my_class(my_class)
    .x_title(my_data.x_axis_title)
    .my_title(my_data.title)
    .is_brushable(my_data.is_brushable)
    .is_zoomable(my_data.is_zoomable)
    .is_stacked(my_data.is_stacked)
    .cursor_type(my_data.cursor_type);

  my_chart(svg);
}

function check_status(my_types,my_data){
  var change_detected = false;
  //sets extents back to undefined if zoomable, brushable or stacked has changed
  my_types.forEach(function(d){
    if(line_props[d] === undefined){
      if(d === "cursor_type"){
        line_props[d] = my_data[d];
      } else {
        line_props[d] = my_data["is_" + d];
      }
    } else if (line_props[d] === my_data["is_" + d]  || line_props[d] === my_data[d] ){
      //do nothing
    } else{
      if(d === "cursor_type"){
        line_props[d] = my_data[d];
      } else {
        line_props[d] = my_data["is_" + d];
      }
      change_detected = true;
    }
  })
  if(change_detected === true){
    line_props.current_extents = {};
  }
}

function line_chart() {
  //REUSABLE line chart

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
    transition_time = 1000,
    my_colours = {},
    y_formats = {},
    axis_y_formats = {},
    y_titles = {},
    y_scales = {},
    y_scales_all = {},
    y_brushes = {},
    cursor_type = "",
    chart_gap = 20,
    brush_width = 30,
      cursor_values = {};

  function my(svg) {

    //define chart height and extra dimensions
    var chart_height = (height - (line_data.length - 1) * chart_gap) / line_data.length;
    var chart_down = chart_height;
    var axis_left = 0;
    var mouseover_left = 0;
    var mouseover_bottom = 0;
    if (is_stacked === false) {
      //if no stacking, set extra dimensions and rest height, chart_height, width and start_x
      axis_left = 50;
      mouseover_left = 33;
      mouseover_bottom = 15;
      start_x += (line_data.length-1) * axis_left;
      height -= line_data.length * 15;
      chart_height = height;
      chart_down = 0;
      chart_gap = 0;
      width = width - axis_left * line_data.length;
    }
    //loop through data and define colours, y_formats and y_scales
    line_data.forEach(function(d,i){
      my_colours[i] = d.colour;
      y_formats[i] = d3.format(d.y_format);
      y_titles[i] = d.y_title;
      axis_y_formats[i] = d3.format(d.axis_y_format);
      var y_max = d3.max(d.data, m => +m.data_value);
      var y_min = d3.min(d.data, m => +m.data_value);
      if (y_min > 0) {y_min = 0;}
      y_scales[i] = d3.scaleLinear().domain([y_min, y_max])
          .range([chart_height - line_props.dot_radius * 2, line_props.dot_radius]);
      y_scales_all[i] = d3.scaleLinear().domain([y_min, y_max])
          .range([chart_height - line_props.dot_radius * 2, line_props.dot_radius]);
    });

    //set x_format and scales
    var percent_format = d3.format(".1%");
    var x_format = d3.timeFormat("%d %b");
    var x_extent = d3.extent(
      line_data[0].data,
      d => new Date(d.timestamp_recorded)
    );
    var x_extra = line_props.dot_radius * 2;
    var x_scale = d3.scaleTime().domain(x_extent).range([line_props.dot_radius, width - x_extra]);
    var x_scale_all = d3.scaleTime().domain(x_extent).range([line_props.dot_radius, width - x_extra]);

    //this section checks whether the latest data is within the current extent or not
    if (line_props.current_extents.x_min === undefined) {
      //sets domains and extents as first time around
      line_props.current_extents = {
        x_min: x_extent[0],
        x_max: x_extent[1],
        y_min: get_y_extent(0),
        y_max: get_y_extent(1)
      };
      line_props.x_scale_domain = x_extent;

      line_data.forEach(function(d,i){
        line_props.highlighted_ranges[i] = x_extent;
        line_props.y_scale_domains[i] = y_scales_all[i].domain();
      });
    } else if (x_extent[0] < line_props.current_extents.x_min ||
        x_extent[1] > line_props.current_extents.x_max) {
      //resetting as out of bounds
      line_props.current_extents = {
        x_min: x_extent[0],
        x_max: x_extent[1],
        y_min: get_y_extent(0),
        y_max: get_y_extent(1)
      };
      line_props.x_scale_domain = x_extent;
      line_data.forEach(function(d,i){
        line_props.highlighted_ranges[i] = x_extent;
        line_props.y_scale_domains[i] = [get_y_extent(0), get_y_extent(1)];
      })
    } else {
      //keeping current
      x_scale.domain(line_props.x_scale_domain);
      line_data.forEach(function(d,i){
        y_scales[i].domain(line_props.y_scale_domains[i]);
      })
    }

    //now define brushes and zoom
    var x_brush = d3.brushX()
      .extent([[x_extra/2, 0], [width - (x_extra/2), brush_width]])
      .on("brush end", brushed_x);

    var cursor_brush = d3.brushX()
      .extent([[x_extra/2, 0], [width - (x_extra/2), chart_height - (x_extra/2)]])
      .on("end", cursor_brushed);

    line_data.forEach(function(d,i){
      y_brushes[i] = d3.brushY()
          .extent([[0, x_extra/2], [brush_width, chart_height - (x_extra/2)]])
          .on("brush end", brushed_y);
    });

    var zoom = d3.zoom()
        .scaleExtent([1, Infinity]).translateExtent([[0, 0], [width, chart_height]])
        .extent([[0, 0], [width, chart_height]])
        .on("zoom", zoomed);

    //axis definitions
    var x_axis_all = d3.axisBottom(x_scale_all).tickSizeOuter(0);
    var x_axis = d3.axisBottom(x_scale).tickSizeOuter(0);


    function y_axis(my_index) {
      var my_format = axis_y_formats[my_index];
      return d3.axisLeft(y_scales[my_index]).tickSizeOuter(0)
        .tickFormat(d => is_stacked === false ? "" :
            y_scales_all[my_index].domain()[0] === 0 ? d > 0 ? my_format(d) : "" : my_format(d));
    }

    function y_axis_all(my_index) {
      var my_format = axis_y_formats[my_index];
      return d3.axisLeft(y_scales_all[my_index]).tickSizeOuter(0)
        .tickFormat(d => y_scales_all[my_index].domain()[0] === 0 ? (d > 0 ? my_format(d) : "") : my_format(d));
    }

    //append non-data dependent elements (if first time)
    if (d3.select(".x_axis" + my_class)._groups[0][0] === null) {
      svg.append("text").attr("class", "title title" + my_class);
      svg.append("text").attr("class", "cursor_values cursor_values" + my_class);
      svg.append("g").attr("class", "axis x_axis" + my_class);
      svg.append("g").attr("class", "axis_all x_axis_all" + my_class);
      svg.append("text").attr("class", "mouseover_text mouseover_text" + my_class);
      svg.append("text").attr("class", "axis_title x_title" + my_class);
      svg.append("g").attr("class", "normal_brush x_brush" + my_class);
      svg.append("defs").append("clipPath").attr("id", "clip")
        .append("rect").attr("class", "clip_rect" + my_class);
      svg.append("defs").append("clipPath").attr("id", "clip_x_axis")
          .append("rect").attr("class", "clip_rect_x_axis" + my_class);
      svg.append("defs").append("clipPath").attr("id", "clip_y_axis")
          .append("rect").attr("class", "clip_rect_y_axis" + my_class);

      line_data.forEach(function(d,i){
        svg.append("g").attr("class", "y_axis axis y_axis" + my_class + i);
        svg.append("g").attr("class", "axis_all y_axis_all" + my_class + i);
        svg.append("text").attr("class", "axis_title y_title" + my_class + i);
        svg.append("g").attr("class", "normal_brush y_brush" + my_class + i);
        svg.append("line").attr("class", "mouseover_path x_mouseover" + my_class + i);
        svg.append("line").attr("class", "mouseover_path y_mouseover" + my_class + i);
        svg.append("rect").attr("class", "mouseover_rect y_mouseover_rect" + my_class + i);
        svg.append("text").attr("class", "mouseover_text y_mouseover_text" + my_class + i);
        svg.append("rect").attr("class", "mouseover_rect x_mouseover_rect" + my_class + i);
        svg.append("text").attr("class", "mouseover_text x_mouseover_text" + my_class + i);
        svg.append("rect").attr("class", "zoom_rect zoom_rect" + my_class + i);
        svg.append("g").attr("class", "axis_grid y_axis_grid" + my_class + i);
        svg.append("g").attr("class", "axis_grid x_axis_grid" + my_class + i);
        svg.append("g").attr("class", "cursor_brush double_cursor_brush" + my_class + i);
        svg.append("text").attr("class", "cursor_text cursor_text_left cursor_text_left"
            + my_class + i + " cursor_text" + my_class + i);
        svg.append("text").attr("class", "cursor_text cursor_text_right cursor_text_right" +
            my_class + i + " cursor_text" + my_class + i);
        svg.append("text").attr("class", "cursor_text cursor_text_middle cursor_text_middle" +
            my_class + i + " cursor_text" + my_class + i);

      });
      svg.append("rect").attr("class", "cursor_rect cursor_rect_1" + my_class);
    }
    //set non-data dep properties in order

    d3.select(".title" + my_class)
      .attr("y", -20)
      .text(my_title)
      .attr("transform", "translate(" + start_x + "," + start_y + ")");

    d3.select(".cursor_values" + my_class)
        .attr("x",width)
        .attr("y", -20)
        .text("")
        .attr("transform", "translate(" + start_x + "," + start_y + ")");

    d3.select(".x_axis" + my_class)
      .call(x_axis).attr(
        "transform", "translate(" + start_x + "," + (start_y + height + 1) + ")");

    if (is_brushable === true) {
      d3.select(".x_axis_all" + my_class).attr("display", "block")
        .call(x_axis_all)
        .attr("transform", "translate(" + start_x + "," + (start_y + height +
              20 + (line_data.length - 1) * mouseover_bottom) + ")");
    } else {
      d3.select(".x_axis_all" + my_class).attr("display", "none");
    }

    d3.select(".mouseover_text" + my_class).attr("y", -20)
      .attr("transform", "translate(" + (start_x + width) + "," + start_y + ")");

    d3.select(".x_title" + my_class)
      .attr("x", width / 2)
      .text(x_title)
      .attr("transform", "translate(" + start_x + "," +
          (start_y + (is_brushable === true ? 64 : 40) + height) + ")");

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
        .attr("transform", "translate(" + (-60) + ",0)");

    //set visibility depending on selected cursor type
    if (cursor_type === "single") {
      d3.select(".cursor_rect_1" + my_class)
        .style("display", "block")
        .attr("height", height)
        .attr("transform", "translate(" + start_x + "," + start_y + ")");

      d3.selectAll(".cursor_text").style("display", "none");
    } else if (cursor_type === "double") {
      d3.select(".cursor_rect_1" + my_class).style("display", "none");

      d3.selectAll(".cursor_text")
        .style("display", "block")
        .text("");
    }

    line_data.forEach(function(d,i){
      i = +i;
      var transform_y = (start_y + i * (chart_down + chart_gap));

      d3.select(".x_axis_grid" + my_class + i)
          .attr("clip-path", "url('#clip_x_axis')").call(x_axis)
          .attr("transform", "translate(" + start_x + "," +
              (transform_y + chart_height) + ")");


      d3.selectAll(".x_axis_grid" + my_class + i + " .tick line")
          .attr("y1", -chart_height)
          .attr("y2", 0);

      d3.select(".x_mouseover_rect" + my_class + i)
          .style("visibility","hidden")
          .attr("y", chart_height + i * (chart_down + chart_gap))
          .attr("height", 15)
          .attr("width", 60)
          .attr("transform", "translate(" + start_x + "," +
              (start_y + line_props.dot_radius + i * mouseover_bottom) + ")");

      d3.select(".x_mouseover" + my_class + i)
          .style("visibility","hidden");

      d3.select(".y_mouseover" + my_class + i)
          .style("visibility","hidden");

      d3.select(".x_mouseover_text" + my_class + i)
          .style("visibility","hidden")
          .style("fill", my_colours[i])
          .attr("y", chart_height + 15 + i * (chart_down + chart_gap))
          .attr("transform", "translate(" + start_x + "," + (start_y + i * mouseover_bottom) + ")");

      d3.select(".y_mouseover_rect" + my_class + i)
          .style("visibility","hidden")
          .attr("x", -30)
          .attr("height", 15)
          .attr("width", 35)
          .attr("transform", "translate(" + (start_x - mouseover_left - (i * axis_left) -
              line_props.dot_radius) + "," + (transform_y - (15 / 2)) + ")");

      d3.select(".y_mouseover_text" + my_class + i)
          .style("visibility","hidden")
          .style("fill", my_colours[i])
          .attr("x", -(31 / 2))
          .attr("dy", 4)
          .attr("y", 15)
          .attr("transform", "translate(" + (start_x - mouseover_left - (i * axis_left)) +
              "," + transform_y + ")");

      //brushable
      d3.select(".y_title" + my_class + i)
          .attr("fill", is_stacked === false ? my_colours[i] : "#333333")
          .text(y_titles[i])
          .attr("transform", "translate(" + (start_x - 8 - brush_width - (is_brushable === true ? 30 : (is_stacked === false ? 30 : 0)) -
              ((+i) * axis_left)) + "," +
              (transform_y + (chart_height/2)) + ") rotate(-90)");

      d3.select(".y_axis" + my_class + i)
          .call(y_axis(i))
          .attr("transform", "translate(" + (start_x - 1) + "," + transform_y + ")");

      if (is_brushable === true  || (is_stacked === false && is_brushable === false)) {
        d3.select(".y_axis_all" + my_class + i)
            .attr("display", "block")
            .call(y_axis_all(i))
            .attr("transform", "translate(" + (start_x - 38 - (i * axis_left)) +
                "," + transform_y + ")");
      } else {
        if (is_stacked === true) {
          d3.select(".y_axis_all" + my_class + i).attr("display", "none");
        } else {
          d3.select(".y_axis_all" + my_class + i).attr("display", "block");
        }
      }

      d3.select(".y_axis_grid" + my_class + i)
          .attr("clip-path", "url('#clip')")
          .call(y_axis)
          .attr("transform", "translate(" + start_x + "," + transform_y + ")");

      d3.selectAll(".y_axis" + my_class + i + " .tick text")
          .attr("text-anchor", "middle");

      d3.selectAll(".y_axis_all" + my_class + i + " .tick text")
          .attr("text-anchor", "middle")
          .attr("x", -10);

      d3.selectAll(".y_axis_grid" + my_class + i + " .tick line")
          .attr("x1", 0)
          .attr("x2", width);

      if (cursor_type === "double") {
        var x_range = [x_scale_all(line_props.highlighted_ranges[i][0]),
          x_scale_all(line_props.highlighted_ranges[i][1])];
        if(+i === 0 || (i > 0 && is_stacked === true)){
          d3.select(".double_cursor_brush" + my_class + i)
              .attr("id", "cursorbrush_" + i)
              .attr("display", "block")
              .attr("transform", "translate(" + start_x + "," + transform_y + ")")
              .call(cursor_brush)
              .call(cursor_brush.move, x_range);

          d3.selectAll(".cursor_text" + my_class + i)
              .attr("transform", "translate(" + start_x + ","
                  + (transform_y - 2) + ")");
        } else {
          d3.select(".double_cursor_brush" + my_class + i)
              .attr("display", "block").attr("display", "none");
        }
      } else {

        d3.select(".cursor_brush" + my_class).attr("display", "none");

        d3.select(".double_cursor_brush" + my_class + i)
            .attr("display","none")
            .on(".brush", null)
            .on(".end", null);

        d3.selectAll(".dot_circle" + my_class)
            .interrupt().transition().duration(150)
            .attr("r", line_props.dot_radius);
      }

      var y_range = [y_scales_all[i](line_props.y_scale_domains[i][1]),
        y_scales_all[i](line_props.y_scale_domains[i][0])];

      d3.select(".y_brush" + my_class + i)
          .attr("display", "block")
          .attr("id", "brushy_" + i)
          .attr("transform", "translate(" + (start_x - 63 - i * axis_left) +
              "," + transform_y + ")")
          .call(y_brushes[i])
          .call(y_brushes[i].move, y_range);

        if (is_brushable === true) {

          d3.selectAll(".y_brush" + my_class + i + " .handle")
              .attr("display", "block");
        } else {
          if (is_stacked === true) {
            d3.select(".y_brush" + my_class + i).attr("display", "none");
          } else {
            d3.select(".y_brush" + my_class + i).attr("display", "block");

            d3.selectAll(".y_brush" + my_class + i + " .handle")
                .attr("display", "none");
          }
          d3.select(".y_brush" + my_class + i)
              .on(".brush", null)
              .on(".end", null);
        }

      d3.selectAll(".y_brush" + my_class + i + " .selection")
          .style("fill", is_stacked === true ? "#A0A0A0" : my_colours[i]);

      if (is_zoomable === true) {
        d3.select(".zoom_rect" + my_class + i)
            .attr("visibility", is_stacked === true ? "visible": (+i > 0 ? "hidden" : "visible"))
            .attr("id", "zoomrect_" + i)
            .attr("width", width)
            .attr("height", chart_height)
            .attr("transform", "translate(" + start_x + "," + transform_y + ")")
            .call(zoom);
      } else {
        d3.select(".zoom_rect" + my_class + i)
            .attr("visibility", is_stacked === true ? "visible": (+i > 0 ? "hidden" : "visible"))
            .attr("id", "zoomrect_" + i)
            .attr("width", width)
            .attr("height", chart_height)
            .attr("transform", "translate(" + start_x + "," + transform_y + ")")
            .on(".zoom", null);
      }
    });

    d3.select(".cursor_rect_1" + my_class)
        .on("mouseover",function(d){d3.select(this).attr("cursor","grab")})
        .call(d3.drag()
            .on("start",function(d){
              d3.select(this).attr("cursor","grabbing")
            })
            .on("drag",function(d){
              d3.select(this).attr("x", d3.event.sourceEvent.offsetX - start_x - 4);
            })
            .on("end", function() {
              if (cursor_type === "single") {
                d3.select(this).attr("x", d3.event.sourceEvent.offsetX - start_x - 4);
                d3.selectAll(".dot_circle" + my_class)
                    .interrupt().transition().duration(150)
                    .attr("r", line_props.dot_radius);
                find_nearest_point(d3.event.sourceEvent.offsetX - start_x, my_class);
              }}));


    reset_x();
    reset_y();

    if (is_brushable === true) {
      var x_range = [x_scale_all(line_props.x_scale_domain[0]),
        x_scale_all(line_props.x_scale_domain[1])];

      d3.select(".x_brush" + my_class)
        .attr("display", "block")
        .attr("transform", "translate(" + start_x + "," +
            (start_y + height + 21 + (line_data.length - 1) * mouseover_bottom) + ")")
        .call(x_brush)
        .call(x_brush.move, x_range);
    } else {
      d3.select(".x_brush" + my_class).attr("display", "none")
        .on("brush", null).on("end", null);
    }

    //now data dependent elements (only 1 this time)
    var my_group = svg.selectAll(".line_group")
      .data(line_data)
      .join(function(group) {
        var enter = group.append("g").attr("class", "line_group");
        enter.append("path").attr("class", "line_path line_path" + my_class)
          .attr("clip-path", "url('#clip')");
        enter.append("g").attr("class", "dot_group" + my_class);
        return enter;
      });

    //line path
    my_group.select(".line_path" + my_class)
      .attr("fill", "none")
      .attr("stroke", (d, i) => my_colours[i])
      .attr("d", (d, i) =>
        d3.line()
          .x(f => x_scale(new Date(f.timestamp_recorded)))
          .y(f => y_scales[i](f.data_value))(d.data)
      )
      .attr("transform", (d, i) => "translate(" +
          start_x + "," + (start_y + (+i) * (chart_down + chart_gap)) + ")");

    my_group.select(".dot_group" + my_class).attr("id", (d, i) => "dc_" + i);

    var dot_group = my_group.select(".dot_group" + my_class).selectAll(".dot_group")
      .data(d => d.data)
      .join(function(group) {
        var enter = group.append("g").attr("class", "dot_group");
        enter.append("circle").attr("class", "dot_circle" + my_class)
          .attr("clip-path", "url('#clip')");
        return enter;
      });

    dot_group.select(".dot_circle" + my_class)
      .attr("r", function(d){
        if(d3.select(this).attr("r") === null){
          return line_props.dot_radius;
        } else {
          return d3.select(this).attr("r");
        }

      })
      .attr("cx", d => x_scale(new Date(d.timestamp_recorded)))
      .attr("cy", function(d) {
        d.parent_index = +this.parentElement.parentElement.id.split("_")[1];
        return y_scales[d.parent_index](d.data_value);
      })
      .attr("id", (d, i) => "dot_" + d.parent_index + i)
      .attr("fill", d => my_colours[d.parent_index])
      .attr("transform", d => "translate(" + start_x +
          "," + (start_y + d.parent_index * (chart_down + chart_gap)) + ")")
        .attr("class",function(d){
          return  "dot_circle" + my_class + " dot_circle" + my_class + d.parent_index
        });

    function cursor_brushed() {
      if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
      if(cursor_type === "single") return; //don't brush if single cursor
      var s = d3.event.selection || x_scale_all.range();
      var my_id = this.id.split("_")[1];
      var highlighted_range = s.map(x_scale.invert, x_scale);
      line_props.highlighted_ranges[my_id] = highlighted_range;
      var current_data = line_data[my_id].data;
      var got_first = false, first_dot = -1, last_dot = -1, first_value = "", last_value = "";


      d3.selectAll(".dot_circle" + my_class + my_id)
          .attr("r", line_props.dot_radius);


      current_data.forEach(function(d,i){
        if (new Date(d.timestamp_recorded) >= highlighted_range[0] && got_first === false) {
          first_dot = +i;
          first_value = d.data_value;
          got_first = true;
        } else if (new Date(d.timestamp_recorded) <= highlighted_range[1]) {
          last_dot = +i;
          last_value = d.data_value;
        }
      })

      if (first_dot > last_dot) {
        d3.selectAll(".cursor_text").text("");
      } else {
        if (cursor_values[y_titles[my_id]] === undefined){
          cursor_values[y_titles[my_id]] = {};
        }
        cursor_values[y_titles[my_id]]["start"] = y_formats[my_id](first_value);
        cursor_values[y_titles[my_id]]["middle"] = percent_format((last_value - first_value) / first_value);
        cursor_values[y_titles[my_id]]["end"] = y_formats[my_id](last_value);

        d3.select(".cursor_text_left" + my_class + my_id)
          .attr("y", 12)
          .attr("x", x_scale(highlighted_range[0]) + 5)
          .text(x_format(highlighted_range[0]));

        d3.select(".cursor_text_middle" + my_class + my_id)
          .attr("x", x_scale(highlighted_range[0]) +
              (x_scale(highlighted_range[1]) - x_scale(highlighted_range[0])) / 2)
          .text(d3.timeDay.count(highlighted_range[0], highlighted_range[1]) +
              " days");

        d3.select(".cursor_text_right" + my_class + my_id)
          .attr("x", x_scale(highlighted_range[1]) - 5)
          .attr("y", chart_height)
          .text(x_format(highlighted_range[1]));

        d3.selectAll("#dot_" + my_id + first_dot)
          .attr("r", line_props.dot_radius * 2);

        d3.selectAll("#dot_" + my_id + last_dot)
          .attr("r", line_props.dot_radius * 2);
      }
      var values_text = "";
      for(var c in cursor_values){
         values_text +=  c + ": from " + cursor_values[c].start + " to " + cursor_values[c].end
             + " - " + cursor_values[c].middle + " change ";
      }
      d3.select(".cursor_values" + my_class)
          .text(values_text);
    }

    d3.selectAll(".cursor_rect").raise();
    d3.selectAll(".cursor_brush").raise()
    function brushed_x() {
      if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
      var s = d3.event.selection || x_scale_all.range();
      if(s[0] < 0){s[0] = 0};
      if(s[1] < 0){s[1] = 0};
      x_scale.domain(s.map(x_scale_all.invert, x_scale_all));
      line_props.x_scale_domain = x_scale.domain();
      reset_x();
      if (is_zoomable === true) {
        line_data.forEach(function(d,i){
          svg.select(".zoom_rect" + my_class + i)
             .call(zoom.transform, d3.zoomIdentity.scale(width / (s[1] - s[0])).translate(-s[0], 0));
        })
      }
    }

    function brushed_y() {
      if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
      var my_id = this.id.split("_")[1];
      var s = d3.event.selection || y_scales_all[my_id].range();
      if(s[0] < 0){s[0] = 0};
      if(s[1] < 0){s[1] = 0};
      y_scales[my_id].domain(s.map(y_scales_all[my_id].invert, y_scales_all[my_id]).reverse());
      line_props.y_scale_domains[my_id] = y_scales[my_id].domain();

      reset_y();
      if (is_zoomable === true) {
        line_data.forEach(function(d,i){
          svg.select(".zoom_rect" + my_class + i)
             .call(zoom.transform, d3.zoomIdentity.scale(height / (s[1] - s[0])).translate(0, -s[0]));
        })
      }
    }

    function zoomed() {
      if (d3.event.sourceEvent.type === "wheel" || d3.event.sourceEvent.type === "mousemove") {
        var y_id = this.id.split("_")[1];
        var t = d3.event.transform;
        x_scale.domain(t.rescaleX(x_scale_all).domain());
        y_scales[y_id].domain(t.rescaleY(y_scales_all[y_id]).domain());
        line_props.x_scale_domain = x_scale.domain();
        line_props.y_scale_domains[y_id] = y_scales[y_id].domain();
        reset_x();
        reset_y();
        if (is_brushable === true) {
          svg.select(".x_brush" + my_class)
            .call(x_brush.move, x_scale.range().map(t.invertX, t));
          var reverse_y_scale = y_scales[y_id].range().reverse();
          svg.select(".y_brush" + my_class + y_id)
            .call(y_brushes[y_id].move, reverse_y_scale.map(t.invertY, t));
        }
      }
    }

    function reset_x() {
      d3.selectAll(".line_path" + my_class)
          .attr("d", (d, i) => d3.line()
          .x(f => x_scale(new Date(f.timestamp_recorded)))
          .y(f => y_scales[i](f.data_value))(d.data)
      );

      d3.selectAll(".dot_circle" + my_class)
        .attr("cx", d => x_scale(new Date(d.timestamp_recorded)));

      d3.select(".x_axis" + my_class).call(x_axis);

      d3.selectAll(".x_axis" + my_class + " .tick text").attr("y", 3);

      line_data.forEach(function(d,i){

        if(d3.select("#cursorbrush_" + i).node()  !== null){
          var x_range = [x_scale(line_props.x_scale_domain[0]),
            x_scale(line_props.x_scale_domain[1])];
          d3.select("#cursorbrush_" + i)
              .call(cursor_brush.move, x_range);
        }
        d3.select(".x_axis_grid" + my_class + i)
            .call(d3.axisBottom(x_scale).tickSizeOuter(0).tickValues(x_scale_all.ticks()));

        d3.selectAll(".x_axis_grid" + my_class + i + " .tick line")
            .attr("y1", -chart_height)
            .attr("y2", 0);
      })
    }

    function reset_y() {

      d3.selectAll(".line_path" + my_class)
          .attr("d", (d, i) => d3.line()
          .x(f => x_scale(new Date(f.timestamp_recorded)))
          .y(f => y_scales[i](f.data_value))(d.data)
      );

      line_data.forEach(function(d,i){

        d3.selectAll(".dot_circle" + my_class)
            .attr("cy", function(d) {
            return y_scales[this.parentElement.parentElement.id.split("_")[1]](d.data_value);
            });

        d3.select(".y_axis" + my_class).call(y_axis(i));

        d3.selectAll(".y_axis" + my_class + i + " .tick text")
            .attr("text-anchor", "middle")
            .attr("x", -10)
            .attr("y", 0);

        d3.select(".y_axis_grid" + my_class + i)
            .call(d3.axisLeft(y_scales[i]).tickSizeOuter(0)
                .tickValues(y_scales_all[i].ticks()));

        d3.selectAll(".y_axis_grid" + my_class + i + " .tick line")
            .attr("x1", 0)
            .attr("x2", width);

      });
    }

    function find_nearest_point(my_x, my_class) {
      for (var l in line_data) {
        var transform_y = (start_y + l * (chart_down + chart_gap));
        for (var i in line_data[l].data) {
          if (x_scale(new Date(line_data[l].data[i].timestamp_recorded)) > my_x) {
            var nearest = line_data[l].data[+i - 1];
            if (nearest !== undefined) {
              var nearest_date = new Date(nearest.timestamp_recorded);
              d3.select("#dot_" + l + (+i - 1))
                  .interrupt().transition().duration(300)
                  .attr("r", line_props.dot_radius * 1.5);
              //position x_mouseover_ rect

              d3.select(".x_mouseover" + my_class + l)
                  .attr("clip-path", "url('#clip')")
                  .attr("x1", x_scale(nearest_date) - line_props.dot_radius)
                  .attr("x2", x_scale(nearest_date) - line_props.dot_radius * 1.5 - 0.5)
                  .attr("y1", y_scales[l](nearest.data_value))
                  .attr("y2", y_scales[l](nearest.data_value))
                  .attr("transform", "translate(" + start_x + "," + transform_y + ")")
                  .style("visibility", "visible")
                  .style("stroke", my_colours[l])
                  .transition()
                  .duration(transition_time)
                  .attr("x1", Math.max(x_scale(0), 0));

              d3.select(".x_mouseover_rect" + my_class + l)
                  .style("visibility", "visible")
                  .transition()
                  .duration(transition_time)
                  .attr("x", x_scale(nearest_date) - 30);

              //and axis text
              d3.select(".x_mouseover_text" + my_class + l)
                  .style("visibility", "visible")
                  .transition()
                  .duration(transition_time)
                  .attr("x", x_scale(nearest_date))
                  .text(x_format(nearest_date));

              d3.select(".y_mouseover" + my_class + l)
                  .attr("clip-path", "url('#clip')")
                  .attr("x1", x_scale(nearest_date))
                  .attr("x2", x_scale(nearest_date))
                  .attr("y1", y_scales[l](nearest.data_value) + line_props.dot_radius)
                  .attr("y2", y_scales[l](nearest.data_value) + line_props.dot_radius * 1.5 + 0.5)
                  .attr("transform", "translate(" + start_x + "," + transform_y + ")")
                  .style("visibility", "visible")
                  .style("stroke", my_colours[l])
                  .transition()
                  .duration(transition_time)
                  .attr("y1", Math.min(y_scales[l](0), height) + line_props.dot_radius);

              d3.select(".y_mouseover_rect" + my_class + l)
                  .attr("clip-path", "url('#clip_y_axis')")
                  .style("visibility", "visible")
                  .transition()
                  .duration(transition_time)
                  .attr("y", y_scales[l](nearest.data_value));

              d3.select(".y_mouseover_text" + my_class + l)
                  .attr("clip-path", "url('#clip_y_axis')")
                  .style("visibility", "visible")
                  .transition()
                  .duration(transition_time)
                  .attr("y", y_scales[l](nearest.data_value))
                  .text(y_formats[l](nearest.data_value));
            }
            break;
          }

        }
      }
    }

    function get_y_extent(extent_index){

        var my_value = 0;

        for(let y in y_scales_all){
          var my_extent = y_scales_all[y].domain()[extent_index];
          if((+y) === 0){
            my_value = my_extent;
          } else {
            if(extent_index === 0){
              if(my_extent < my_value){my_value = my_extent;}
            } else {
              if(my_extent > my_value){my_value = my_extent;}
            }}
        }
        return my_value;

      }

  }

  my.width = function(value) {
    if (!arguments.length) return width;
    width = value;
    return my;
  };

  my.height = function(value) {
    if (!arguments.length) return height;
    height = value;
    return my;
  };

  my.start_x = function(value) {
    if (!arguments.length) return start_x;
    start_x = value;
    return my;
  };

  my.start_y = function(value) {
    if (!arguments.length) return start_y;
    start_y = value;
    return my;
  };

  my.line_data = function(value) {
    if (!arguments.length) return line_data;
    line_data = value;
    return my;
  };

  my.my_class = function(value) {
    if (!arguments.length) return my_class;
    my_class = value;
    return my;
  };

  my.my_title = function(value) {
    if (!arguments.length) return my_title;
    my_title = value;
    return my;
  };

  my.x_title = function(value) {
    if (!arguments.length) return x_title;
    x_title = value;
    return my;
  };


  my.is_brushable = function(value) {
    if (!arguments.length) return is_brushable;
    is_brushable = value;
    return my;
  };

  my.is_zoomable = function(value) {
    if (!arguments.length) return is_zoomable;
    is_zoomable = value;
    return my;
  };

  my.cursor_type = function(value) {
    if (!arguments.length) return cursor_type;
    cursor_type = value;
    return my;
  };

  my.is_stacked = function(value) {
    if (!arguments.length) return is_stacked;
    is_stacked = value;
    return my;
  };

  return my;
}
