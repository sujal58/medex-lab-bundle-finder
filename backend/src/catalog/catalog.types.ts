export interface LabTest {
  id: string;
  code: string;
  name: string;
  price: number | null;
  status: boolean;
}

export interface LabPackage {
  id: string;
  name: string;
  price: number;
  testIds: string[];
  status: boolean;
}

export interface LabCatalog {
  tests: LabTest[];
  packages: LabPackage[];
}
