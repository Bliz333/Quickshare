package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class PageVO<T> {
    private List<T> records;
    private long total;
    private long pages;
    private long current;
    private long size;
}
