package com.uniquindio.etl.sorting;

import java.util.*;

public class SortingAlgorithms {

    // TIMSORT (MANUAL)
    public static void timSort(int[] arr) {
        int n = arr.length;
        int RUN = 32;

        for (int i = 0; i < n; i += RUN) {
            insertionSort(arr, i, Math.min(i + RUN - 1, n - 1));
        }

        for (int size = RUN; size < n; size *= 2) {
            for (int left = 0; left < n; left += 2 * size) {

                int mid = left + size - 1;
                int right = Math.min(left + 2 * size - 1, n - 1);

                if (mid < right)
                    merge(arr, left, mid, right);
            }
        }
    }

    // INSERTION SORT
    private static void insertionSort(int[] arr, int left, int right) {
        for (int i = left + 1; i <= right; i++) {
            int key = arr[i];
            int j = i - 1;

            while (j >= left && arr[j] > key) {
                arr[j + 1] = arr[j];
                j--;
            }

            arr[j + 1] = key;
        }
    }

    // MERGE
    private static void merge(int[] arr, int l, int m, int r) {

        int len1 = m - l + 1;
        int len2 = r - m;

        int[] left = new int[len1];
        int[] right = new int[len2];

        for (int i = 0; i < len1; i++)
            left[i] = arr[l + i];

        for (int i = 0; i < len2; i++)
            right[i] = arr[m + 1 + i];

        int i = 0, j = 0, k = l;

        while (i < len1 && j < len2) {
            if (left[i] <= right[j])
                arr[k++] = left[i++];
            else
                arr[k++] = right[j++];
        }

        while (i < len1) arr[k++] = left[i++];
        while (j < len2) arr[k++] = right[j++];
    }

    // COMB SORT
    public static void combSort(int[] arr) {
        int n = arr.length;
        int gap = n;
        boolean swapped = true;

        while (gap != 1 || swapped) {
            gap = (gap * 10) / 13;
            if (gap < 1) gap = 1;

            swapped = false;

            for (int i = 0; i < n - gap; i++) {
                if (arr[i] > arr[i + gap]) {
                    int temp = arr[i];
                    arr[i] = arr[i + gap];
                    arr[i + gap] = temp;
                    swapped = true;
                }
            }
        }
    }

    // SELECTION SORT
    public static void selectionSort(int[] arr) {
        for (int i = 0; i < arr.length - 1; i++) {
            int min = i;
            for (int j = i + 1; j < arr.length; j++) {
                if (arr[j] < arr[min]) min = j;
            }
            int temp = arr[min];
            arr[min] = arr[i];
            arr[i] = temp;
        }
    }

    // TREE SORT
    static class Node {
        int value;
        Node left, right;
        Node(int v) { value = v; }
    }

    public static void treeSort(int[] arr) {
        Node root = null;

        for (int num : arr)
            root = insert(root, num);

        List<Integer> sorted = new ArrayList<>();
        inorder(root, sorted);

        for (int i = 0; i < arr.length; i++)
            arr[i] = sorted.get(i);
    }

    private static Node insert(Node root, int val) {
        if (root == null) return new Node(val);

        if (val < root.value)
            root.left = insert(root.left, val);
        else
            root.right = insert(root.right, val);

        return root;
    }

    private static void inorder(Node root, List<Integer> res) {
        if (root != null) {
            inorder(root.left, res);
            res.add(root.value);
            inorder(root.right, res);
        }
    }

    // PIGEONHOLE SORT
    public static void pigeonholeSort(int[] arr) {

        int min = arr[0];
        int max = arr[0];

        for (int i = 1; i < arr.length; i++) {
            if (arr[i] < min) min = arr[i];
            if (arr[i] > max) max = arr[i];
        }

        int size = max - min + 1;
        int[] holes = new int[size];

        for (int x : arr)
            holes[x - min]++;

        int index = 0;
        for (int i = 0; i < size; i++) {
            while (holes[i]-- > 0) {
                arr[index++] = i + min;
            }
        }
    }

    // BUCKET SORT
    public static void bucketSort(int[] arr) {
        int n = arr.length;
        if (n <= 0) return;

        int max = arr[0];
        for (int i = 1; i < n; i++) {
            if (arr[i] > max) max = arr[i];
        }

        List<List<Integer>> buckets = new ArrayList<>();
        for (int i = 0; i < n; i++)
            buckets.add(new ArrayList<>());

        for (int num : arr) {
            int index = (num * n) / (max + 1);
            buckets.get(index).add(num);
        }

        int k = 0;
        for (List<Integer> bucket : buckets) {
            insertionSortList(bucket);
            for (int num : bucket)
                arr[k++] = num;
        }
    }

    private static void insertionSortList(List<Integer> list) {

        for (int i = 1; i < list.size(); i++) {

            int key = list.get(i);
            int j = i - 1;

            while (j >= 0 && list.get(j) > key) {
                list.set(j + 1, list.get(j));
                j--;
            }

            list.set(j + 1, key);
        }
    }

    // QUICKSORT
    public static void quickSort(int[] arr, int low, int high) {
        if (low < high) {
            int pi = partition(arr, low, high);
            quickSort(arr, low, pi - 1);
            quickSort(arr, pi + 1, high);
        }
    }

    private static int partition(int[] arr, int low, int high) {
        int pivot = arr[high];
        int i = low - 1;

        for (int j = low; j < high; j++) {
            if (arr[j] < pivot) {
                i++;
                int temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
            }
        }

        int temp = arr[i + 1];
        arr[i + 1] = arr[high];
        arr[high] = temp;

        return i + 1;
    }

    // HEAP SORT
    public static void heapSort(int[] arr) {
        int n = arr.length;
        for (int i = n / 2 - 1; i >= 0; i--)
            heapify(arr, n, i);

        for (int i = n - 1; i > 0; i--) {

            int temp = arr[0];
            arr[0] = arr[i];
            arr[i] = temp;

            heapify(arr, i, 0);
        }
    }

    private static void heapify(int[] arr, int n, int i) {
        int largest = i;
        int l = 2 * i + 1;
        int r = 2 * i + 2;

        if (l < n && arr[l] > arr[largest]) largest = l;
        if (r < n && arr[r] > arr[largest]) largest = r;

        if (largest != i) {

            int temp = arr[i];
            arr[i] = arr[largest];
            arr[largest] = temp;

            heapify(arr, n, largest);
        }
    }

    // BITONIC SORT
    public static void bitonicSort(int[] arr, int low, int cnt, boolean dir) {
        if (cnt > 1) {
            int k = cnt / 2;
            bitonicSort(arr, low, k, true);
            bitonicSort(arr, low + k, k, false);
            bitonicMerge(arr, low, cnt, dir);
        }
    }

    private static void bitonicMerge(int[] arr, int low, int cnt, boolean dir) {
        if (cnt > 1) {
            int k = cnt / 2;
            for (int i = low; i < low + k; i++) {
                if (dir == (arr[i] > arr[i + k])) {
                    int temp = arr[i];
                    arr[i] = arr[i + k];
                    arr[i + k] = temp;
                }
            }
            bitonicMerge(arr, low, k, dir);
            bitonicMerge(arr, low + k, k, dir);
        }
    }

    // GNOME SORT
    public static void gnomeSort(int[] arr) {
        int i = 0;
        while (i < arr.length) {

            if (i == 0 || arr[i] >= arr[i - 1]) {
                i++;
            } else {

                int temp = arr[i];
                arr[i] = arr[i - 1];
                arr[i - 1] = temp;

                i--;
            }
        }
    }

    // BINARY INSERTION SORT
    public static void binaryInsertionSort(int[] arr) {
        for (int i = 1; i < arr.length; i++) {
            int key = arr[i];
            int pos = binarySearch(arr, key, 0, i - 1);

            for (int j = i - 1; j >= pos; j--) {
                arr[j + 1] = arr[j];
            }

            arr[pos] = key;
        }
    }

    private static int binarySearch(int[] arr, int key, int low, int high) {
        while (low <= high) {
            int mid = (low + high) / 2;
            if (arr[mid] == key)
                return mid + 1;
            if (arr[mid] < key)
                low = mid + 1;
            else
                high = mid - 1;
        }
        return low;
    }

    // RADIX SORT
    public static void radixSort(int[] arr) {

        int max = arr[0];

        for (int i = 1; i < arr.length; i++) {
            if (arr[i] > max) max = arr[i];
        }

        for (int exp = 1; max / exp > 0; exp *= 10)
            countingSort(arr, exp);
    }

    private static void countingSort(int[] arr, int exp) {
        int n = arr.length;
        int[] output = new int[n];
        int[] count = new int[10];

        for (int i = 0; i < n; i++)
            count[(arr[i] / exp) % 10]++;

        for (int i = 1; i < 10; i++)
            count[i] += count[i - 1];

        for (int i = n - 1; i >= 0; i--) {

            int index = (arr[i] / exp) % 10;

            output[count[index] - 1] = arr[i];
            count[index]--;
        }

        for (int i = 0; i < n; i++)
            arr[i] = output[i];
    }
}